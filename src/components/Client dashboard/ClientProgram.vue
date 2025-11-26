<script setup lang="ts">
import { ref, computed, type ComponentPublicInstance } from 'vue'
import ProgramCard from './ProgramCard.vue'
import type { Program, RequirementItem, RuleItem } from '../../stores/programs'
import { useUserStore } from '../../stores/users'
import { useSubmissionsStore, type ClientDocument } from '../../stores/submissions'
import { useProgramsStore } from '../../stores/programs'
import { providersStore } from '../../stores/providers'
import supabase from '../../lib/Supabase'

interface TrainingResultLike {
  feature_schema?: string[] | Record<string, unknown>
  features?: string[] | Record<string, unknown>
}

interface ExtractedData {
  api_result?: OcrResult
  rules?: string
  requirement_key?: string
  _storagePath?: string
}

interface OcrResult {
  doc_type?: string
  raw_text?: string
  rules?: string
  structured_output?: {
    document_type?: string
    extracted_fields?: Record<string, string | number | boolean>
    matched_requirement?: string
    validation?: {
      status?: string
      missing_fields?: string[]
      invalid_conditions?: string[]
    }
  }
}

const props = defineProps<{ program: Program }>()

// State moved from ProgramCard
const uploads = ref<
  Record<
    string,
    {
      name: string
      uploading: boolean
      error?: string
      file?: File | null
      ocr?: OcrResult
      submitted?: boolean
      file_url?: string
    }
  >
>({})
const submissionId = ref<string | null>(null)
const existingDocs = ref<
  Record<string, { docId: string | number; file_url: string; extracted: ExtractedData }>
>({})

// Dialog states
const programOpen = ref(false)
const previewOpen = ref(false)
const previewKey = ref<string | null>(null)
const reuseOpen = ref(false)
const reuseKey = ref<string | null>(null)
const predictOpen = ref(false)

// Prediction related state
const mappingLoading = ref(false)
const mappingError = ref<string | null>(null)
const mappedFeatures = ref<Record<string, unknown> | null>(null)
const featureSchema = ref<string[] | Record<string, unknown> | null>(null)
const mappingUsedDocs = ref<string[]>([])
const predictSnackShow = ref(false)
const predictSnackText = ref('')
const predictSnackColor = ref<'error' | 'success' | 'warning'>('error')

// Reuse documents
const pastDocs = ref<ClientDocument[]>([])
const pastLoading = ref(false)

// Stores
const userStore = useUserStore()
const submissions = useSubmissionsStore()
const programsStore = useProgramsStore()
const ps = providersStore()

// Provider name helper
const providerEntry = computed(() =>
  ps.providers.find((p) => String(p.id) === String(props.program.provider_id)),
)
const providerName = computed(() => providerEntry.value?.agency_name || 'Unknown Provider')

// Rules string retained for document extracted meta
const rulesString = computed(() => {
  const rules = (props.program.rules || []) as RuleItem[]
  if (!rules.length) return ''
  return rules
    .map((r) => {
      const structured = `${r.field || ''} ${r.operator || ''} ${r.value ?? ''}`.trim()
      const statement = (r.note || '').toString().trim()
      return statement || structured
    })
    .filter(Boolean)
    .join(', ')
})

// Prediction logic
async function predictEligibility() {
  if (mappingLoading.value) return
  mappingLoading.value = true
  mappingError.value = null
  mappedFeatures.value = null
  mappingUsedDocs.value = []
  if (!Object.keys(existingDocs.value).length) {
    mappingLoading.value = false
    predictSnackText.value = 'No documents submitted yet. Upload requirements first.'
    predictSnackColor.value = 'error'
    predictSnackShow.value = true
    return
  }
  try {
    const training = await programsStore.fetchLatestTrainingResult(
      props.program.id as string | number,
    )
    const schemaCandidate =
      (training as TrainingResultLike)?.feature_schema || (training as TrainingResultLike)?.features
    if (schemaCandidate) featureSchema.value = schemaCandidate as string[] | Record<string, unknown>
  } catch (e) {
    console.warn('Failed to fetch training result for feature schema', e)
  }
  const extractedAggregate: Record<string, unknown> = {}
  for (const [key, meta] of Object.entries(existingDocs.value)) {
    const apiResult = meta.extracted?.api_result as OcrResult | undefined
    const status = apiResult?.structured_output?.validation?.status
    if (status === 'passed') {
      extractedAggregate[key] = apiResult || {}
      mappingUsedDocs.value.push(key)
    }
  }
  if (!mappingUsedDocs.value.length) {
    mappingLoading.value = false
    predictSnackText.value = 'No passed documents to map. Please resubmit failing documents.'
    predictSnackColor.value = 'warning'
    predictSnackShow.value = true
    return
  }
  const payload: Record<string, unknown> = {
    program_id: props.program.id,
    extracted_data: extractedAggregate,
  }
  if (featureSchema.value) payload.features = featureSchema.value

  // EXACT payload log
  console.log('[features/map] SUBMIT PAYLOAD:\n' + JSON.stringify(payload, null, 2))

  try {
    const res = await fetch('http://localhost:5000/features/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()

    // EXACT response log
    console.log(
      '[features/map] RESPONSE:\nStatus:',
      res.status,
      '\nBody:\n' + JSON.stringify(data, null, 2),
    )

    if (!res.ok || data.status !== 'success') {
      mappingError.value = data.error || data.llm_error || res.statusText
    } else {
      mappedFeatures.value = data.features || null
      featureSchema.value = data.feature_schema || featureSchema.value
      // Persist eligibility decision in client_submissions.decision_tree_result
      try {
        // Ensure we have a submission id; if not, attempt to locate pending one
        if (!submissionId.value && userStore.user_id) {
          submissionId.value = await submissions.findOrGetPendingSubmission(
            userStore.user_id,
            props.program.id as string | number,
          )
        }
        if (submissionId.value) {
          const decision = isEligible.value ? 'eligible' : 'not eligible'
          const subsAny: unknown = submissions
          const maybeSetter = (
            subsAny as { setDecisionTreeResult?: (id: string | number, r: string) => Promise<void> }
          ).setDecisionTreeResult
          if (typeof maybeSetter === 'function') {
            await maybeSetter(submissionId.value, decision)
            console.log(
              '[predictEligibility] Stored decision_tree_result via store action:',
              decision,
            )
          } else {
            // Fallback direct Supabase update if action not available (HMR or stale store instance)
            const { error: dtError } = await supabase
              .from('client_submissions')
              .update({ decision_tree_result: decision })
              .eq('id', Number(submissionId.value))
            if (dtError) {
              console.error('[predictEligibility] Fallback update failed:', dtError)
            } else {
              console.log(
                '[predictEligibility] Stored decision_tree_result via fallback:',
                decision,
              )
            }
          }
        } else {
          console.warn(
            '[predictEligibility] No submissionId available to store decision_tree_result',
          )
        }
      } catch (persistErr) {
        console.error('[predictEligibility] Failed to store decision_tree_result', persistErr)
      }
    }
    predictOpen.value = true
  } catch (err: unknown) {
    mappingError.value = err instanceof Error ? err.message : String(err)
  } finally {
    mappingLoading.value = false
  }
}

const cleanedFeatures = computed(() => {
  if (!mappedFeatures.value) return [] as Array<{ key: string; label: string; value: unknown }>
  return Object.entries(mappedFeatures.value)
    .filter(([k]) => !['eligible', 'prediction'].includes(k))
    .map(([key, value]) => {
      const label = key
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase())
      return { key, label, value }
    })
})

const missingFeatures = computed(() =>
  cleanedFeatures.value
    .filter((f) => f.value === null || f.value === '' || f.value === undefined)
    .map((f) => f.label),
)
const isEligible = computed(() => {
  if (!mappedFeatures.value) return false
  if ('eligible' in mappedFeatures.value)
    return Boolean(mappedFeatures.value['eligible'] as unknown as boolean | string)
  if ('prediction' in mappedFeatures.value) {
    const pred = mappedFeatures.value['prediction'] as unknown as boolean | string
    if (typeof pred === 'string')
      return ['eligible', 'approved', 'true'].includes(pred.toLowerCase())
    if (typeof pred === 'boolean') return pred
  }
  return missingFeatures.value.length === 0
})

const mappingUsedDocsDisplay = computed(() => {
  const reqs = (props.program.requirements || []) as RequirementItem[]
  return mappingUsedDocs.value.map((key) => {
    const parts = key.split('-')
    const idx = Number(parts.pop())
    const namePart = parts.slice(1).join('-')
    const req = reqs[idx]
    return req?.name || namePart || key
  })
})

// File processing & OCR
async function processFile(key: string, file: File) {
  if (!uploads.value[key]) uploads.value[key] = { name: '', uploading: false }
  uploads.value[key].name = file.name
  uploads.value[key].uploading = true
  uploads.value[key].error = undefined
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('doc_type', 'printed')
    const singleReqCtx = (() => {
      const parts = key.split('-')
      const idx = Number(parts.pop())
      const req = (props.program.requirements || [])[idx] as RequirementItem | undefined
      if (!req) return ''
      const name = (req.name || '').toString().trim()
      const desc = (req.description || '').toString().trim()
      const details =
        desc ||
        (req.type === 'document'
          ? req.description?.trim() || `Provide ${req.name}`
          : req.description?.toString().trim() || `Please provide ${req.name}`)
      return name && details ? `${name}: ${details}` : name || details
    })()
    if (singleReqCtx) fd.append('requirements_for_LLM', singleReqCtx)
    const res = await fetch('http://127.0.0.1:5000/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || res.statusText)
    uploads.value[key].file = file
    uploads.value[key].ocr = data as OcrResult
    // Auto-submit immediately after OCR success
    if (!userStore.isUserLoaded) await userStore.fetchUser()
    const clientId = userStore.user_id
    if (!clientId) throw new Error('User not found for auto-submit.')
    const programId = props.program.id as unknown as string | number
    if (!submissionId.value) {
      submissionId.value =
        (await submissions.findOrGetPendingSubmission(clientId, programId)) ||
        (await submissions.createSubmission(clientId, programId))
    }
    const extracted = {
      api_result: uploads.value[key].ocr,
      rules: rulesString.value,
      requirement_key: key,
    }
    await submissions.addDocument(
      submissionId.value,
      uploads.value[key].ocr?.doc_type || 'printed',
      file,
      extracted,
      { bucket: 'client-submissions', directory: 'uploads' },
    )
    uploads.value[key].submitted = true
    existingDocs.value[key] = {
      docId: submissions.documents[0]?.id || 'unknown',
      file_url: submissions.documents[0]?.file_url || '',
      extracted,
    }
    // Optional snackbar notification
    predictSnackText.value = `Uploaded & submitted ${key}`
    predictSnackColor.value = 'success'
    predictSnackShow.value = true
  } catch (err: unknown) {
    uploads.value[key].error = err instanceof Error ? err.message : String(err)
  } finally {
    uploads.value[key].uploading = false
  }
}

function onFileSelected(key: string, file: File) {
  void processFile(key, file)
  reuseOpen.value = false
}

// Reuse past documents
async function loadPastDocuments() {
  if (!userStore.isUserLoaded) await userStore.fetchUser()
  const clientId = userStore.user_id
  if (!clientId) return
  pastLoading.value = true
  try {
    const docs = await submissions.fetchAllUserDocuments(clientId)
    pastDocs.value = docs
  } finally {
    pastLoading.value = false
  }
}

function openUploadChooser(key: string) {
  reuseKey.value = key
  reuseOpen.value = true
  void loadPastDocuments()
}

async function reuseDocument(doc: ClientDocument) {
  if (!reuseKey.value) return
  // Close chooser immediately for responsive UX
  reuseOpen.value = false
  try {
    let file: File
    if (/^https?:\/\//i.test(doc.file_url)) {
      const resp = await fetch(doc.file_url)
      const blob = await resp.blob()
      file = new File([blob], doc.file_url.split('/').pop() || 'document')
    } else {
      const { data, error } = await supabase.storage
        .from('client-submissions')
        .download(doc.file_url)
      if (error) throw error
      file = new File([data], doc.file_url.split('/').pop() || 'document')
    }
    await processFile(reuseKey.value, file)
  } catch (e: unknown) {
    alert('Failed to reuse document: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// Preview helpers
const activeOcr = computed<OcrResult | null>(() => {
  const key = previewKey.value
  if (!key) return null
  return uploads.value[key]?.ocr || null
})

// Filter out noisy auto-generated signature fields from extracted fields display
const filteredExtractedFields = computed<Record<string, string | number | boolean>>(() => {
  const raw = activeOcr.value?.structured_output?.extracted_fields || {}
  const omit = new Set([
    'signature_confidence',
    'signature_present_external',
    'signature_confidence_external',
  ])
  const entries = Object.entries(raw).filter(([k]) => !omit.has(k))
  return Object.fromEntries(entries) as Record<string, string | number | boolean>
})

function resubmit() {
  if (!previewKey.value) return
  previewOpen.value = false
  setTimeout(() => programCardRef.value?.triggerFilePicker(previewKey.value!), 50)
}

// submitCurrent removed: auto-submit now happens in processFile

function openExisting(key: string) {
  previewKey.value = key
  const doc = existingDocs.value[key]
  if (doc) {
    uploads.value[key] = uploads.value[key] || { name: 'Uploaded document', uploading: false }
    uploads.value[key].ocr = (doc.extracted?.api_result || {}) as OcrResult
  }
  previewOpen.value = true
}

async function confirmResubmit() {
  const key = previewKey.value
  if (!key) return
  const docMeta = existingDocs.value[key]
  if (!docMeta) return resubmit()
  const ok = window.confirm('Resubmit? This will delete the previous document.')
  if (!ok) return
  try {
    const storagePath: string | undefined = docMeta.extracted?._storagePath
    await submissions.deleteDocument(docMeta.docId, 'client-submissions', storagePath)
    delete existingDocs.value[key]
    uploads.value[key].ocr = undefined
    uploads.value[key].submitted = false
    resubmit()
  } catch (e: unknown) {
    console.error('Failed to delete previous document', e)
    alert('Failed to delete previous document. See console for details.')
  }
}

// Past document display helper
interface StoredExtractedMeta {
  api_result?: {
    doc_type?: string
    structured_output?: { document_type?: string; matched_requirement?: string }
  }
  requirements_for_LLM?: string
  requirement_key?: string
}
function docDisplayMeta(doc: ClientDocument) {
  const extracted = (doc.extracted_data as StoredExtractedMeta | null) || null
  const structured = extracted?.api_result?.structured_output
  const documentType =
    structured?.document_type || extracted?.api_result?.doc_type || doc.doc_type || 'Document'
  const matchedReq =
    structured?.matched_requirement ||
    extracted?.requirements_for_LLM ||
    extracted?.requirement_key ||
    'Unknown requirement'
  return { name: documentType, requirement: matchedReq }
}

// ProgramCard ref to trigger file pickers
const programCardRef = ref<
  (ComponentPublicInstance & { triggerFilePicker: (key: string) => void }) | null
>(null)

// Initial load existing documents
import { onMounted } from 'vue'
onMounted(async () => {
  if (!userStore.isUserLoaded) await userStore.fetchUser()
  if (ps.providers.length === 0) await ps.fetchProviders()
  if (!userStore.user_id) return
  const clientId = userStore.user_id
  const programId = props.program.id as string | number
  const pendingId = await submissions.findOrGetPendingSubmission(clientId, programId)
  if (!pendingId) return
  submissionId.value = pendingId
  await submissions.fetchDocuments(pendingId)
  for (const doc of submissions.documents) {
    const extracted: ExtractedData = (doc.extracted_data as ExtractedData) || {}
    const reqKey = extracted?.requirement_key
    if (!reqKey) continue
    existingDocs.value[reqKey] = { docId: doc.id, file_url: doc.file_url, extracted }
    uploads.value[reqKey] = uploads.value[reqKey] || {
      name: 'Uploaded document',
      uploading: false,
      submitted: true,
    }
    uploads.value[reqKey].submitted = true
    uploads.value[reqKey].ocr = extracted.api_result as OcrResult
  }
})
</script>

<template>
  <div class="client-program-wrapper">
    <ProgramCard
      ref="programCardRef"
      :program="program"
      :uploads="uploads"
      :existing-docs="existingDocs"
      :mapping-loading="mappingLoading"
      @open-upload="openUploadChooser"
      @open-existing="openExisting"
      @file-selected="onFileSelected"
      @predict="predictEligibility"
      @view-program="programOpen = true"
    />

    <!-- Preview Dialog -->
    <v-dialog v-model="previewOpen" max-width="560">
      <v-card>
        <v-card-title class="text-h6">
          Document detected:
          {{ activeOcr?.structured_output?.document_type || activeOcr?.doc_type || 'Unknown' }}
        </v-card-title>
        <v-card-text>
          <div class="text-caption text-medium-emphasis mb-3">
            Review details below. Use Resubmit to replace this document if the extraction seems
            incorrect.
          </div>
          <div v-if="activeOcr?.structured_output?.matched_requirement" class="mb-2">
            <strong>Matched Requirement:</strong>
            <span class="text-medium-emphasis">{{
              activeOcr?.structured_output?.matched_requirement
            }}</span>
          </div>
          <v-divider class="my-2" />
          <div class="text-subtitle-2 mb-1">Extracted Fields</div>
          <v-list density="compact" class="py-0">
            <v-list-item
              v-for="(val, key) in filteredExtractedFields"
              :key="String(key)"
              class="px-0"
            >
              <v-list-item-title class="text-body-2">{{ key }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">{{ String(val) }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="!Object.keys(filteredExtractedFields).length" class="px-0">
              <v-list-item-subtitle class="text-caption text-medium-emphasis"
                >No fields extracted.</v-list-item-subtitle
              >
            </v-list-item>
          </v-list>
          <template v-if="activeOcr?.structured_output?.validation">
            <v-divider class="my-3" />
            <div class="text-subtitle-2 mb-1">Validation Summary</div>
            <div class="mb-2 d-flex align-center ga-2">
              <strong>Status:</strong>
              <v-chip
                size="small"
                :color="
                  activeOcr?.structured_output?.validation?.status === 'passed'
                    ? 'success'
                    : 'error'
                "
                variant="tonal"
              >
                {{ activeOcr?.structured_output?.validation?.status || 'unknown' }}
              </v-chip>
            </div>
            <div
              v-if="activeOcr?.structured_output?.validation?.missing_fields?.length"
              class="mb-2"
            >
              <strong>Missing Fields:</strong>
              <span class="text-medium-emphasis">{{
                activeOcr?.structured_output?.validation?.missing_fields?.join(', ')
              }}</span>
            </div>
            <div
              v-if="activeOcr?.structured_output?.validation?.invalid_conditions?.length"
              class="mb-2"
            >
              <strong>Invalid Conditions:</strong>
              <span class="text-medium-emphasis">{{
                activeOcr?.structured_output?.validation?.invalid_conditions?.join(', ')
              }}</span>
            </div>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmResubmit">Resubmit</v-btn>
          <v-btn variant="text" @click="previewOpen = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Upload / Reuse Chooser Dialog -->
    <v-dialog v-model="reuseOpen" max-width="820">
      <v-card>
        <v-card-title class="text-h6">Select Existing or Upload New</v-card-title>
        <v-card-text>
          <div class="text-caption text-medium-emphasis mb-3">
            Choose a previously submitted document or upload a new one.
          </div>
          <div v-if="pastLoading" class="text-medium-emphasis mb-2">Loading documents...</div>
          <div v-else-if="!pastDocs.length" class="text-medium-emphasis mb-4">
            No past documents found. Upload a new document.
          </div>
          <v-row v-else dense>
            <v-col v-for="doc in pastDocs" :key="doc.id" cols="12" sm="6" md="4" class="mb-3">
              <v-sheet
                rounded="md"
                elevation="2"
                class="pa-3 d-flex flex-column ga-2"
                height="100%"
              >
                <div class="d-flex align-start ga-2">
                  <v-avatar size="40" color="primary" variant="tonal">
                    <v-icon icon="mdi-file" />
                  </v-avatar>
                  <div class="grow">
                    <div class="text-body-2 font-weight-medium">{{ docDisplayMeta(doc).name }}</div>
                    <div class="text-caption text-medium-emphasis">
                      Submitted For: {{ docDisplayMeta(doc).requirement }}
                    </div>
                  </div>
                </div>
                <div class="d-flex justify-end mt-auto">
                  <v-btn size="x-small" color="primary" variant="tonal" @click="reuseDocument(doc)"
                    >Use This</v-btn
                  >
                </div>
              </v-sheet>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            size="small"
            variant="outlined"
            color="primary"
            @click="programCardRef?.triggerFilePicker(reuseKey || '')"
            >Upload New</v-btn
          >
          <v-btn variant="text" @click="reuseOpen = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Program Details Dialog -->
    <v-dialog v-model="programOpen" max-width="780">
      <v-card>
        <v-card-title class="text-h6">{{ program.name }}</v-card-title>
        <v-card-text>
          <div class="text-body-2 mb-2">
            <strong>Category:</strong> {{ program.category || 'Program' }}
          </div>
          <div class="text-body-2 mb-2">
            <strong>Provider:</strong> <span class="text-medium-emphasis">{{ providerName }}</span>
          </div>
          <div class="text-body-2 mb-4">
            <strong>Description:</strong>
            <span class="text-medium-emphasis">{{ program.description || 'No description' }}</span>
          </div>
          <v-divider class="my-3" />
          <div class="text-subtitle-2 mb-2">
            Requirements ({{ program.requirements?.length || 0 }})
          </div>
          <v-list density="compact" class="py-0">
            <v-list-item
              v-for="(req, idx) in program.requirements"
              :key="`detail-req-${idx}`"
              class="px-0"
            >
              <v-list-item-title class="text-body-2 text-wrap">{{ req.name }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption requirement-subtitle text-wrap">{{
                req.description || req.name
              }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="!program.requirements?.length" class="px-0">
              <v-list-item-subtitle class="text-caption text-medium-emphasis"
                >No requirements</v-list-item-subtitle
              >
            </v-list-item>
          </v-list>
          <v-divider class="my-3" />
          <div class="text-subtitle-2 mb-2">
            Guidelines/Eligibility ({{ program.rules?.length || 0 }})
          </div>
          <v-list density="compact" class="py-0">
            <v-list-item v-for="(r, idx) in program.rules" :key="`detail-rule-${idx}`" class="px-0">
              <v-list-item-title class="text-body-2">
                <template v-if="r.field && String(r.field).trim()"
                  >{{ r.field }} {{ r.operator }} {{ r.value }}</template
                >
                <template v-else
                  ><span class="text-wrap">{{ r.note || '—' }}</span></template
                >
              </v-list-item-title>
              <v-list-item-subtitle v-if="r.field && String(r.field).trim()" class="text-caption">{{
                r.note
              }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="!program.rules?.length" class="px-0">
              <v-list-item-subtitle class="text-caption text-medium-emphasis"
                >No rules</v-list-item-subtitle
              >
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="programOpen = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Prediction Result Dialog -->
    <v-dialog v-model="predictOpen" max-width="680">
      <v-card>
        <v-card-title class="text-h6">Mapped Features</v-card-title>
        <v-card-text>
          <div v-if="mappingError" class="text-error mb-3">Error: {{ mappingError }}</div>
          <template v-else>
            <div class="mb-3" v-if="mappingUsedDocsDisplay.length">
              <strong>Documents Used:</strong>
              <span class="text-medium-emphasis">{{ mappingUsedDocsDisplay.join(', ') }}</span>
            </div>
            <div class="mb-3 d-flex align-center ga-2">
              <strong>Status:</strong>
              <v-chip :color="isEligible ? 'success' : 'error'" variant="tonal" size="small">
                {{ isEligible ? 'Eligible' : 'Not Eligible' }}
              </v-chip>
            </div>
            <div v-if="!mappedFeatures" class="text-medium-emphasis">No features mapped.</div>
            <template v-else>
              <div v-if="!isEligible && missingFeatures.length" class="mb-3">
                <strong>Missing / Unresolved:</strong>
                <span class="text-medium-emphasis">{{ missingFeatures.join(', ') }}</span>
              </div>
              <v-list density="compact" class="py-0">
                <v-list-item v-for="f in cleanedFeatures" :key="f.key" class="px-0">
                  <v-list-item-title class="text-body-2 text-wrap">{{ f.label }}</v-list-item-title>
                  <v-list-item-subtitle class="text-caption">{{
                    f.value === null || f.value === undefined || f.value === ''
                      ? '—'
                      : String(f.value)
                  }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </template>
          </template>
          <v-divider class="my-3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="predictOpen = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Prediction feedback snackbar -->
    <v-snackbar v-model="predictSnackShow" :color="predictSnackColor" :timeout="3000">
      {{ predictSnackText }}
      <template #actions>
        <v-btn variant="text" @click="predictSnackShow = false">Close</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.ga-2 {
  gap: 0.5rem;
}
.client-program-wrapper {
  width: 100%;
}
/* Ensure wrapped text inside list items (titles/subtitles) actually wraps instead of truncating */
:deep(.text-wrap),
:deep(.requirement-subtitle),
:deep(.v-list-item-title.text-wrap),
:deep(.v-list-item-subtitle.text-wrap) {
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: unset !important;
  display: block; /* enforce block so long text can wrap */
}

/* If Vuetify applies max-width constraints, relax them within dialogs */
:deep(.v-dialog .v-list-item-title.text-wrap),
:deep(.v-dialog .v-list-item-subtitle.text-wrap) {
  max-width: 100% !important;
}
</style>
