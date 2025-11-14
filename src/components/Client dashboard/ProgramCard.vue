<script setup lang="ts">
import { ref, computed, type ComponentPublicInstance } from 'vue'
import type { Program, RequirementItem, RuleItem } from '../../stores/programs'
import { useUserStore } from '../../stores/users'
import { useSubmissionsStore } from '../../stores/submissions'

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
    fields?: Record<string, string | number | boolean>
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

// Program details dialog
const programOpen = ref(false)

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
    if (rulesString.value) fd.append('rules', rulesString.value)
    const res = await fetch('http://127.0.0.1:5000/upload', { method: 'POST', body: fd })
    const data = await res.json()
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
      rules: rulesString.value,
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
        <div class="text-caption text-medium-emphasis mb-2">
          These details are read automatically and cannot be edited.
        </div>
        <v-list density="compact" class="py-0">
          <v-list-item
            v-for="(val, key) in activeOcr?.structured_output?.fields || {}"
            :key="String(key)"
            class="px-0"
          >
            <v-list-item-title class="text-body-2">{{ key }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption">{{ String(val) }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
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
            <v-list-item-subtitle class="text-caption">
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
          <v-list-item v-for="(r, rIdx) in program.rules" :key="`detail-rule-${rIdx}`" class="px-0">
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
</template>

<style scoped>
.ga-2 {
  gap: 0.5rem;
}
</style>
