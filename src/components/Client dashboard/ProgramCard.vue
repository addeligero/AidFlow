<script setup lang="ts">
import { ref, computed, type ComponentPublicInstance } from 'vue'
import type { Program, RequirementItem, RuleItem } from '../../stores/programs'
import { useUserStore } from '../../stores/users'
import { useSubmissionsStore } from '../../stores/submissions'
import { useProgramsStore } from '../../stores/programs'

interface TrainingResultLike {
  feature_schema?: string[] | Record<string, unknown>
  features?: string[] | Record<string, unknown>
}

const props = defineProps<{ program: Program }>()

type ExtractedData = {
  api_result?: OcrResult
  rules?: string
  requirement_key?: string
  _storagePath?: string
}

type OcrResult = {
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

const userStore = useUserStore()
const submissions = useSubmissionsStore()
const submissionId = ref<string | null>(null)
// Map requirement key -> client document id (if already stored)
const existingDocs = ref<
  Record<string, { docId: string | number; file_url: string; extracted: ExtractedData }>
>({})

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

// Extract requirement name + description into a single string for LLM upload context
const requirements_for_LLM = computed(() => {
  const reqs = (props.program.requirements || []) as RequirementItem[]
  if (!reqs.length) return ''
  return reqs
    .map((r) => {
      const name = (r.name || '').toString().trim()
      const desc = (r.description || '').toString().trim()
      const details = desc || requirementLabel(r)
      if (name && details) return `${name}: ${details}`
      return name || details
    })
    .filter(Boolean)
    .join('\n')
})

onMounted(() => {
  console.log('Rules:', props.program.rules)
  console.log('requirements_for_LLM:', requirements_for_LLM.value)
})

// Program details dialog
const programOpen = ref(false)

// Prediction state
const predictOpen = ref(false)
const mappingLoading = ref(false)
const mappingError = ref<string | null>(null)
const mappedFeatures = ref<Record<string, unknown> | null>(null)
const featureSchema = ref<string[] | Record<string, unknown> | null>(null)

const programsStore = useProgramsStore()

// Determine if all requirements have a submitted document
const allRequirementsSubmitted = computed(() => {
  const reqs = (props.program.requirements || []) as RequirementItem[]
  if (!reqs.length) return false
  return reqs.every((r, idx) => {
    const key = keyForRequirement(r, idx)
    return !!existingDocs.value[key]
  })
})

async function predictEligibility() {
  if (mappingLoading.value) return
  mappingLoading.value = true
  mappingError.value = null
  mappedFeatures.value = null
  // Attempt to fetch latest training result to obtain feature schema
  try {
    const training = await programsStore.fetchLatestTrainingResult(
      props.program.id as string | number,
    )
    const schemaCandidate =
      (training as TrainingResultLike)?.feature_schema || (training as TrainingResultLike)?.features
    if (schemaCandidate) {
      featureSchema.value = schemaCandidate as string[] | Record<string, unknown>
    }
  } catch (e) {
    console.warn('Failed to fetch training result for feature schema', e)
  }
  // Aggregate extracted OCR data per requirement
  const extractedAggregate: Record<string, unknown> = {}
  for (const [key, meta] of Object.entries(existingDocs.value)) {
    extractedAggregate[key] = meta.extracted?.api_result || {}
  }
  const payload: Record<string, unknown> = {
    program_id: props.program.id,
    extracted_data: extractedAggregate,
  }
  if (featureSchema.value) payload.features = featureSchema.value
  console.log('[Predict] Submitting payload to /features/map:', payload)
  try {
    const res = await fetch('http://localhost:5000/features/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    console.log('[Predict] Response from /features/map:', data)
    if (!res.ok || data.status !== 'success') {
      mappingError.value = data.error || data.llm_error || res.statusText
    } else {
      mappedFeatures.value = data.features || null
      featureSchema.value = data.feature_schema || featureSchema.value
    }
    predictOpen.value = true
  } catch (err: unknown) {
    mappingError.value = err instanceof Error ? err.message : String(err)
  } finally {
    mappingLoading.value = false
  }
}

// Human-readable mapping of feature output
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

function keyForRequirement(r: RequirementItem, idx: number) {
  return `${r.type}-${r.name}-${idx}`
}

function requirementLabel(r: RequirementItem) {
  if (r.type === 'document') return r.description?.trim() || `Provide ${r.name}`
  const parts = [r.field_key, r.operator, r.value].filter(Boolean)
  return parts.join(' ')
}

const fileRefs = ref<Record<string, HTMLInputElement | null>>({})
function setFileRef(key: string, el: Element | ComponentPublicInstance | null) {
  fileRefs.value[key] = (el as HTMLInputElement) || null
}

async function onFileChange(key: string, e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!uploads.value[key]) uploads.value[key] = { name: '', uploading: false }
  uploads.value[key].name = file.name
  uploads.value[key].uploading = true
  uploads.value[key].error = undefined
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('doc_type', 'printed')
    // Upload requirement descriptions for LLM instead of rules
    if (requirements_for_LLM.value) fd.append('requirements_for_LLM', requirements_for_LLM.value)
    const res = await fetch('http://127.0.0.1:5000/upload', { method: 'POST', body: fd })
    const data = await res.json()
    console.log('OCR upload response:', data)
    if (!res.ok) throw new Error(data.error || res.statusText)
    uploads.value[key].file = file
    uploads.value[key].ocr = data as OcrResult
    // Open preview modal for user to review before submitting
    previewKey.value = key
    previewOpen.value = true
  } catch (err: unknown) {
    uploads.value[key].error = err instanceof Error ? err.message : String(err)
  } finally {
    uploads.value[key].uploading = false
  }
}

// Preview dialog state
const previewOpen = ref(false)
const previewKey = ref<string | null>(null)
const activeOcr = computed<OcrResult | null>(() => {
  const key = previewKey.value
  if (!key) return null
  return uploads.value[key]?.ocr || null
})

function resubmit() {
  if (!previewKey.value) return
  previewOpen.value = false
  // trigger file picker again for the same requirement key
  setTimeout(() => fileRefs.value[previewKey.value!]?.click(), 50)
}

async function submitCurrent() {
  const key = previewKey.value
  if (!key) return
  const state = uploads.value[key]
  if (!state?.file || !activeOcr.value) return

  // Ensure we have client and program ids
  if (!userStore.isUserLoaded) await userStore.fetchUser()
  const clientId = userStore.user_id
  if (!clientId) {
    state.error = 'User not found.'
    return
  }
  const programId = props.program.id as unknown as string | number

  // Create submission once per program-card session
  try {
    if (!submissionId.value) {
      // Try find pending first
      submissionId.value =
        (await submissions.findOrGetPendingSubmission(clientId, programId)) ||
        (await submissions.createSubmission(clientId, programId))
    }
    const extracted = {
      api_result: activeOcr.value,
      rules: rulesString.value, // kept for client display
      requirement_key: key,
    }
    await submissions.addDocument(
      submissionId.value,
      activeOcr.value.doc_type || 'printed',
      state.file,
      extracted,
      {
        bucket: 'client-submissions', // renamed bucket (create or rename in Supabase)
        directory: 'uploads', // keep if policy expects uploads/*
      },
    )
    state.submitted = true
    existingDocs.value[key] = {
      docId: submissions.documents[0]?.id || 'unknown',
      file_url: submissions.documents[0]?.file_url || '',
      extracted,
    }
    previewOpen.value = false
  } catch (e: unknown) {
    state.error = e instanceof Error ? e.message : String(e)
  }
}

function openExisting(key: string) {
  previewKey.value = key
  // reconstruct active OCR view from stored extracted data
  const doc = existingDocs.value[key]
  if (doc) {
    uploads.value[key] = uploads.value[key] || {
      name: 'Uploaded document',
      uploading: false,
    }
    uploads.value[key].ocr = (doc.extracted?.api_result || {}) as OcrResult
  }
  previewOpen.value = true
}

async function confirmResubmit() {
  const key = previewKey.value
  if (!key) return
  const docMeta = existingDocs.value[key]
  if (!docMeta) return resubmit() // fallback
  const ok = window.confirm('Resubmit? This will delete the previous document.')
  if (!ok) return
  try {
    // Attempt to remove storage file path if we stored it in extracted
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

// On mount attempt to load existing pending submission + docs
import { onMounted } from 'vue'
onMounted(async () => {
  if (!userStore.isUserLoaded) await userStore.fetchUser()
  if (!userStore.user_id) return
  const clientId = userStore.user_id
  const programId = props.program.id as string | number
  const pendingId = await submissions.findOrGetPendingSubmission(clientId, programId)
  if (!pendingId) return
  submissionId.value = pendingId
  await submissions.fetchDocuments(pendingId)
  // Map documents back to requirement keys if present
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
  <v-card class="mx-auto h-100 d-flex flex-column" elevation="8">
    <v-card-title class="py-3 d-flex align-center">
      <div>
        <div class="text-subtitle-1 font-weight-medium">{{ program.name }}</div>
        <div class="text-caption text-medium-emphasis">{{ program.category || 'Program' }}</div>
      </div>
      <v-spacer />
      <v-btn size="small" variant="text" @click="programOpen = true">View</v-btn>
    </v-card-title>
    <v-divider />
    <v-card-text>
      <div v-if="!program.requirements?.length" class="text-caption text-medium-emphasis">
        No requirements listed.
      </div>
      <v-list v-else density="compact" class="py-0">
        <v-list-item
          v-for="(req, idx) in program.requirements"
          :key="keyForRequirement(req, idx)"
          class="px-0"
        >
          <template #prepend>
            <v-avatar size="28" color="primary" variant="tonal" class="me-2">
              <v-icon size="18" icon="mdi-file-document" />
            </v-avatar>
          </template>
          <v-list-item-title class="text-body-2">{{ req.name }}</v-list-item-title>
          <v-list-item-subtitle class="text-caption">{{
            requirementLabel(req)
          }}</v-list-item-subtitle>
          <template #append>
            <div class="d-flex align-center ga-2">
              <template v-if="uploads[keyForRequirement(req, idx)]?.submitted">
                <v-btn
                  size="x-small"
                  variant="tonal"
                  color="success"
                  icon="mdi-check"
                  :disabled="true"
                />
                <v-btn
                  size="x-small"
                  variant="text"
                  @click="openExisting(keyForRequirement(req, idx))"
                >
                  View
                </v-btn>
              </template>
              <template v-else>
                <v-btn
                  size="x-small"
                  variant="tonal"
                  color="primary"
                  :loading="uploads[keyForRequirement(req, idx)]?.uploading"
                  @click="fileRefs[keyForRequirement(req, idx)]?.click()"
                >
                  Upload
                </v-btn>
              </template>
            </div>
            <input
              class="d-none"
              :ref="(el) => setFileRef(keyForRequirement(req, idx), el)"
              type="file"
              accept="image/*,application/pdf"
              @change="onFileChange(keyForRequirement(req, idx), $event)"
            />
          </template>
        </v-list-item>
      </v-list>

      <!-- Predict Eligibility Button -->
      <div v-if="allRequirementsSubmitted" class="mt-4 d-flex justify-end">
        <v-btn color="primary" :loading="mappingLoading" @click="predictEligibility">
          Predict Eligibility
        </v-btn>
      </div>

      <v-divider class="my-4" />
      <div class="text-subtitle-2 mb-2">Eligibility Rules</div>
      <div v-if="!program.rules?.length" class="text-caption text-medium-emphasis">
        No rules set.
      </div>
      <v-list v-else density="compact" class="py-0">
        <v-list-item v-for="(r, rIdx) in program.rules" :key="rIdx" class="px-0">
          <v-list-item-title class="text-body-2">
            <template v-if="r.field && String(r.field).trim()">
              {{ r.field }} {{ r.operator }} {{ r.value }}
            </template>
            <template v-else>
              {{ r.note || '—' }}
            </template>
          </v-list-item-title>
          <v-list-item-subtitle v-if="r.field && String(r.field).trim()" class="text-caption">
            {{ r.note }}
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
  <!-- Preview Modal -->
  <v-dialog v-model="previewOpen" max-width="560">
    <v-card>
      <v-card-title class="text-h6">
        Document detected:
        {{ activeOcr?.structured_output?.document_type || activeOcr?.doc_type || 'Unknown' }}
      </v-card-title>
      <v-card-text>
        <div class="text-caption text-medium-emphasis mb-3">
          Review the automatically extracted information. If something is off, choose Resubmit to
          try again.
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
            v-for="(val, key) in activeOcr?.structured_output?.extracted_fields || {}"
            :key="String(key)"
            class="px-0"
          >
            <v-list-item-title class="text-body-2">{{ key }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption">{{ String(val) }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item
            v-if="!Object.keys(activeOcr?.structured_output?.extracted_fields || {}).length"
            class="px-0"
          >
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
                activeOcr?.structured_output?.validation?.status === 'passed' ? 'success' : 'error'
              "
              variant="tonal"
            >
              {{ activeOcr?.structured_output?.validation?.status || 'unknown' }}
            </v-chip>
          </div>
          <div v-if="activeOcr?.structured_output?.validation?.missing_fields?.length" class="mb-2">
            <strong>Missing Fields:</strong>
            <span class="text-medium-emphasis">
              {{ activeOcr?.structured_output?.validation?.missing_fields?.join(', ') }}
            </span>
          </div>
          <div
            v-if="activeOcr?.structured_output?.validation?.invalid_conditions?.length"
            class="mb-2"
          >
            <strong>Invalid Conditions:</strong>
            <span class="text-medium-emphasis">
              {{ activeOcr?.structured_output?.validation?.invalid_conditions?.join(', ') }}
            </span>
          </div>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" v-if="existingDocs[previewKey || '']" @click="confirmResubmit"
          >Resubmit</v-btn
        >
        <v-btn variant="text" v-else @click="resubmit">Resubmit</v-btn>
        <v-btn
          color="primary"
          :loading="submissions.uploading || submissions.creating"
          @click="submitCurrent"
          >Submit</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Program Details Dialog -->
  <v-dialog v-model="programOpen" max-width="780">
    <v-card>
      <v-card-title class="text-h6">
        {{ program.name }}
      </v-card-title>
      <v-card-text>
        <div class="text-body-2 mb-2">
          <strong>Category:</strong> {{ program.category || 'Program' }}
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
            <v-list-item-title class="text-body-2">{{ req.name }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption requirement-subtitle">
              {{ requirementLabel(req) }}
            </v-list-item-subtitle>
          </v-list-item>
          <v-list-item v-if="!program.requirements?.length" class="px-0">
            <v-list-item-subtitle class="text-caption text-medium-emphasis"
              >No requirements</v-list-item-subtitle
            >
          </v-list-item>
        </v-list>
        <v-divider class="my-3" />
        <div class="text-subtitle-2 mb-2">Rules ({{ program.rules?.length || 0 }})</div>
        <v-list density="compact" class="py-0">
          <v-list-item v-for="(r, idx) in program.rules" :key="`detail-rule-${idx}`" class="px-0">
            <v-list-item-title class="text-body-2">
              <template v-if="r.field && String(r.field).trim()">
                {{ r.field }} {{ r.operator }} {{ r.value }}
              </template>
              <template v-else>
                <span class="text-wrap">{{ r.note || '—' }}</span>
              </template>
            </v-list-item-title>
            <v-list-item-subtitle v-if="r.field && String(r.field).trim()" class="text-caption">
              {{ r.note }}
            </v-list-item-subtitle>
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
                <v-list-item-subtitle class="text-caption">
                  {{
                    f.value === null || f.value === undefined || f.value === ''
                      ? '—'
                      : String(f.value)
                  }}
                </v-list-item-subtitle>
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
</template>

<style scoped>
.ga-2 {
  gap: 0.5rem;
}
/* Ensure requirement subtitles wrap and do not show ellipsis */
:deep(.requirement-subtitle) {
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: clip !important;
  display: block !important;
  word-break: break-word;
  /* Remove any max-width constraints inherited */
  max-width: 100% !important;
}
</style>
