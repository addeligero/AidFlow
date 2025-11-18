<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useProgramsStore } from '../../stores/programs'
const ProgramEditorDialog = defineAsyncComponent(() => import('./ProgramEditorDialog.vue'))
import type { RealtimeChannel } from '@supabase/supabase-js'
import supabase from '../../lib/Supabase'

const props = defineProps<{ providerId: string | null }>()

type Program = {
  id: string
  provider_id: string | number
  name: string
  category?: string | null
  description?: string | null
  requirements: unknown[]
  rules: unknown[]
  created_at?: string
  updated_at?: string
}

const store = useProgramsStore()
const programs = computed<Program[]>(() => (store.programs as unknown as Program[]) || [])
const loading = ref(false)
const errorMsg = ref('')

const editorOpen = ref(false)
const editorLoading = ref(false)
const isEdit = ref(false)
const currentId = ref<string | null>(null)
const formName = ref('')
const formCategory = ref('')
const formDescription = ref('')
type LatestTrainingSaved = {
  id: number
  program_id: number
  accuracy: number | null
  features: string[] | null
  rules_summary: string | null
  notes: string | null
  model_path: string | null
  csv_path: string | null
  created_at: string
} | null
const latestTrainingSaved = ref<LatestTrainingSaved>(null)
const viewTrainedOpen = ref(false)

// Structured editors: requirement and rule items
type RequirementType = 'document' | 'condition'

type RequirementItem = {
  type: RequirementType
  name: string
  description?: string | null
  field_key?: string | null
  operator?: ConditionOperator | null
  value?: string | number | boolean | null
}

type RuleItem = {
  field: string
  value: string | number | boolean | null
  note?: string | null
  operator?: ConditionOperator | null
}

const formRequirements = ref<RequirementItem[]>([])
const formRules = ref<RuleItem[]>([])
function setRequirements(v: RequirementItem[]) {
  formRequirements.value = v
}
function setRules(v: RuleItem[]) {
  formRules.value = v
}

// Snapshot of original editor values to detect unsaved changes
const originalProgramSnapshot = ref<string | null>(null)
function makeProgramSnapshot() {
  return JSON.stringify({
    name: formName.value.trim(),
    category: formCategory.value.trim(),
    description: formDescription.value.trim(),
    requirements: formRequirements.value.map((r) => ({ ...r })),
    rules: formRules.value.map((r) => ({ ...r })),
  })
}
function hasProgramUnsavedChanges() {
  if (!editorOpen.value) return false
  if (!originalProgramSnapshot.value) return false
  return originalProgramSnapshot.value !== makeProgramSnapshot()
}

const confirmDeleteOpen = ref(false)
const toDeleteId = ref<string | null>(null)

// Reusable confirmation dialog state
type ConfirmState = { show: boolean; message: string; resolve?: (v: boolean) => void }
const confirmState = ref<ConfirmState>({ show: false, message: '' })
function requestConfirm(message: string) {
  return new Promise<boolean>((resolve) => {
    confirmState.value = { show: true, message, resolve }
  })
}
function confirmYes() {
  confirmState.value.resolve?.(true)
  confirmState.value.show = false
  confirmState.value.message = ''
}
function confirmNo() {
  confirmState.value.resolve?.(false)
  confirmState.value.show = false
  confirmState.value.message = ''
}

const channel = ref<RealtimeChannel | null>(null)

const hasPrograms = computed(() => !loading.value && programs.value.length > 0)

function resetForm() {
  formName.value = ''
  formCategory.value = ''
  formDescription.value = ''
  formRequirements.value = []
  formRules.value = []
}

function openCreate() {
  isEdit.value = false
  currentId.value = null
  resetForm()
  editorOpen.value = true
  originalProgramSnapshot.value = makeProgramSnapshot()
}

function openEdit(row: Program) {
  isEdit.value = true
  currentId.value = row.id
  formName.value = row.name
  formCategory.value = row.category || ''
  formDescription.value = row.description || ''
  formRequirements.value = Array.isArray(row.requirements)
    ? (row.requirements as unknown[]).map(toRequirementItem)
    : []
  formRules.value = Array.isArray(row.rules) ? (row.rules as unknown[]).map(toRuleItem) : []
  editorOpen.value = true
  originalProgramSnapshot.value = makeProgramSnapshot()
  // Load latest training result using wrapper (handles missing method)
  loadLatestTraining(row.id)
}

function confirmDelete(id: string) {
  toDeleteId.value = id
  confirmDeleteOpen.value = true
}

async function deleteProgram() {
  if (!toDeleteId.value || !props.providerId) return
  try {
    const ok = await requestConfirm('Delete this program? This cannot be undone.')
    if (!ok) return
    await store.deleteProgram(toDeleteId.value, props.providerId)
    confirmDeleteOpen.value = false
    toDeleteId.value = null
    await fetchPrograms()
    emit('notify', { text: 'Program deleted' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    errorMsg.value = msg
    emit('notify', { text: msg, color: 'error' })
  }
}

async function saveProgram() {
  if (!props.providerId) return
  editorLoading.value = true
  try {
    const ok = await requestConfirm(
      isEdit.value ? 'Save changes to this program?' : 'Create this program?',
    )
    if (!ok) return
    if (!formName.value.trim()) throw new Error('Program name is required')

    // Validate structured arrays
    if (!Array.isArray(formRequirements.value)) throw new Error('Requirements must be a list')
    if (!Array.isArray(formRules.value)) throw new Error('Rules must be a list')
    for (const r of formRequirements.value) {
      if (!r || !r.type || !r.name?.trim())
        throw new Error('Each requirement must have a type and name')
      if (r.type === 'condition') {
        if (!r.field_key?.toString().trim() || !r.operator) {
          throw new Error('Condition requirement must include field and operator')
        }
      }
    }
    // Rules can now be free-text statements (note) or structured. Require at least one of them.
    for (const rule of formRules.value) {
      const hasStatement = !!rule.note && !!rule.note.toString().trim()
      const hasStructured = !!rule.field?.toString().trim() && !!rule.operator
      if (!hasStatement && !hasStructured) {
        throw new Error('Each rule must be a statement or include field and operator')
      }
    }

    // Persist rules as note-only objects in JSONB
    const rulesPayload = (formRules.value || [])
      .map((r) => {
        const statement = (r.note || '').toString().trim()
        const fallback = `${r.field || ''} ${r.operator || ''} ${r.value ?? ''}`.trim()
        const note = statement || fallback
        if (!note) return null
        return { note }
      })
      .filter(Boolean) as Array<{ note: string }>

    const payload = {
      provider_id: isNaN(Number(props.providerId)) ? props.providerId : Number(props.providerId),
      name: formName.value.trim(),
      category: formCategory.value.trim() || null,
      description: formDescription.value.trim() || null,
      requirements: formRequirements.value as unknown[],
      rules: rulesPayload as unknown[],
      updated_at: new Date().toISOString(),
    }

    if (isEdit.value && currentId.value) {
      await store.updateProgram(currentId.value, payload)
      emit('notify', { text: 'Program updated' })
    } else {
      await store.createProgram(payload)
      emit('notify', { text: 'Program created' })
    }
    editorOpen.value = false
    originalProgramSnapshot.value = null
    await fetchPrograms()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    errorMsg.value = msg
    emit('notify', { text: msg, color: 'error' })
  } finally {
    editorLoading.value = false
  }
}

// Cancel with confirmation if unsaved changes present
function cancelProgramEditor() {
  if (!hasProgramUnsavedChanges()) {
    editorOpen.value = false
    originalProgramSnapshot.value = null
    return
  }
  requestConfirm('Discard unsaved program changes? This cannot be undone.').then((ok) => {
    if (ok) {
      editorOpen.value = false
      originalProgramSnapshot.value = null
    }
  })
}

async function fetchPrograms() {
  if (!props.providerId) {
    store.clearPrograms()
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    await store.fetchProgramsByProvider(props.providerId)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    errorMsg.value = msg
  } finally {
    loading.value = false
  }
}

function subscribeRealtime() {
  if (channel.value) {
    channel.value.unsubscribe()
    channel.value = null
  }
  if (!props.providerId) return
  channel.value = supabase
    .channel(`programs-${props.providerId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'programs',
        filter: `provider_id=eq.${props.providerId}`,
      },
      () => fetchPrograms(),
    )
    .subscribe()
}

watch(
  () => props.providerId,
  async () => {
    if (!props.providerId) {
      store.clearPrograms()
      if (channel.value) {
        channel.value.unsubscribe()
        channel.value = null
      }
      return
    }
    await fetchPrograms()
    subscribeRealtime()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (channel.value) channel.value.unsubscribe()
})

const emit = defineEmits<{
  (e: 'notify', payload: { text: string; color?: string }): void
}>()

defineExpose({
  refresh: fetchPrograms,
  openEditById(id: string) {
    const row = programs.value.find((p) => p.id === id)
    if (row) openEdit(row as Program)
  },
})

// Helpers and local state for structured editors
type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'less_than'
  | 'less_or_equal'
  | 'greater_than'
  | 'greater_or_equal'
  | 'includes'
  | 'exists'

function isRequirementType(v: unknown): v is RequirementType {
  return v === 'document' || v === 'condition'
}
function asRequirementType(v: unknown): RequirementType {
  return isRequirementType(v) ? v : 'document'
}

function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v
  if (v === null || v === undefined) return fallback
  return String(v)
}
function toRequirementItem(raw: unknown): RequirementItem {
  const r = (raw ?? {}) as Record<string, unknown>
  const value = (r as Record<string, unknown>)['value']
  return {
    type: asRequirementType(r.type),
    name: asString(r.name),
    description: (typeof r.description === 'string' ? r.description : null) as string | null,
    field_key: r.field_key ? asString(r.field_key) : null,
    value: (value as string | number | boolean | null | undefined) ?? null,
  }
}

function toRuleItem(raw: unknown): RuleItem {
  const r = (raw ?? {}) as Record<string, unknown>
  const value = (r as Record<string, unknown>)['value']
  return {
    field: asString(r.field),
    value: (value as string | number | boolean | null | undefined) ?? null,
    note: (typeof r.note === 'string' ? r.note : null) as string | null,
  }
}

// Requirement & Rule dialogs now embedded inside ProgramEditorDialog; arrays updated via emitted events.

// Train flow state
type TrainExtractResponse = {
  status: 'success' | 'fail'
  numbered_notes?: string[]
  rules_for_generator?: string
  rules_json?: Array<{ label: string; rule: string }>
  rules_text?: string
  error?: string
}
const trainConfirmOpen = ref(false)
const trainRunning = ref(false)
const trainResultOpen = ref(false)
const trainResult = ref<TrainExtractResponse | null>(null)
// Model training state
type ModelTrainResponse = {
  status: 'success' | 'fail'
  program_id?: string | number
  accuracy?: number
  feature_schema?: string[]
  file_path?: string
  csv_path?: string
  csv?: string
  error?: string
}
const modelTraining = ref(false)
const modelTrainResponse = ref<ModelTrainResponse | null>(null)
const csvPreviewOpen = ref(false)
const trainedCsvContent = ref<string | null>(null)

function openCsvPreview() {
  if (!modelTrainResponse.value?.csv) {
    emit('notify', { text: 'No CSV available to preview', color: 'error' })
    return
  }
  csvPreviewOpen.value = true
}

function downloadCsv() {
  const csv = modelTrainResponse.value?.csv
  if (!csv) {
    emit('notify', { text: 'No CSV available to download', color: 'error' })
    return
  }
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const filename = modelTrainResponse.value?.csv_path?.split('/')?.pop() || 'synthetic.csv'
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    emit('notify', { text: msg, color: 'error' })
  }
}

// Persist successful training outcome for later review
async function saveTrainingResultToDb() {
  if (
    !currentId.value ||
    !modelTrainResponse.value ||
    modelTrainResponse.value.status !== 'success'
  )
    return
  try {
    const programIdNum = Number(currentId.value)
    await store.saveTrainingResult({
      program_id: Number.isNaN(programIdNum) ? (currentId.value as string) : programIdNum,
      accuracy: modelTrainResponse.value.accuracy ?? null,
      feature_schema: modelTrainResponse.value.feature_schema ?? null,
      rules_text: trainResult.value?.rules_text ?? null,
      rules_for_generator: trainResult.value?.rules_for_generator ?? null,
      numbered_notes: trainResult.value?.numbered_notes ?? null,
      file_path: modelTrainResponse.value.file_path ?? null,
      csv_path: modelTrainResponse.value.csv_path ?? null,
    })
    // Refresh latest saved
    latestTrainingSaved.value = await store.fetchLatestTrainingResult(currentId.value)
    emit('notify', { text: 'Training result saved' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Failed to save training result:', msg)
    emit('notify', { text: `Failed to save training result: ${msg}`, color: 'error' })
  }
}

function openTrainConfirm() {
  if (!formRules.value || formRules.value.length === 0) {
    emit('notify', { text: 'Add at least one rule before training', color: 'error' })
    return
  }
  trainConfirmOpen.value = true
}

async function runTrainExtract() {
  trainRunning.value = true
  try {
    const payload = formRules.value
    const res = await fetch('http://localhost:5000/rules/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json()) as TrainExtractResponse
    trainResult.value = data
    if (!res.ok || data.status !== 'success') {
      emit('notify', { text: data.error || 'Training failed', color: 'error' })
    } else {
      emit('notify', { text: 'Rules extracted successfully' })
    }
    trainConfirmOpen.value = false
    trainResultOpen.value = true
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    emit('notify', { text: msg, color: 'error' })
  } finally {
    trainRunning.value = false
  }
}

async function runModelTraining() {
  if (!currentId.value) {
    emit('notify', { text: 'Save the program before training the model', color: 'error' })
    return
  }
  if (!trainResult.value?.rules_json || trainResult.value.rules_json.length === 0) {
    emit('notify', { text: 'No labeled rules to train model', color: 'error' })
    return
  }
  modelTraining.value = true
  modelTrainResponse.value = null
  try {
    const payloadToSend = { program_id: currentId.value, rules: trainResult.value.rules_json }
    console.log('[train_model] submitting payload:', payloadToSend)
    const res = await fetch('http://localhost:5000/train_model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadToSend),
    })
    const data = (await res.json()) as ModelTrainResponse
    console.log('[train_model] response:', data)
    modelTrainResponse.value = data
    if (!res.ok || data.status !== 'success') {
      emit('notify', { text: data.error || 'Model training failed', color: 'error' })
    } else {
      const acc = typeof data.accuracy === 'number' ? (data.accuracy * 100).toFixed(1) : 'N/A'
      emit('notify', { text: `Model trained (accuracy ${acc}%)` })
      // Saving is now performed explicitly by the user via the Confirm button
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    emit('notify', { text: msg, color: 'error' })
    modelTrainResponse.value = { status: 'fail', error: msg }
  } finally {
    modelTraining.value = false
  }
}

// Wrapper to safely load latest training result even if store method missing (hot-reload fallback)
async function loadLatestTraining(programId: string | number) {
  try {
    // TS-safe access
    const maybeFn = (
      store as unknown as {
        fetchLatestTrainingResult?: (id: string | number) => Promise<LatestTrainingSaved>
      }
    ).fetchLatestTrainingResult
    if (typeof maybeFn === 'function') {
      latestTrainingSaved.value = await maybeFn(programId)
      return
    }
    // Fallback direct query if method not present
    const { data, error } = await supabase
      .from('model_training_results')
      .select(
        'id, program_id, accuracy, features, rules_summary, notes, model_path, csv_path, created_at',
      )
      .eq('program_id', programId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error && error.details !== 'Results contain 0 rows') throw error
    latestTrainingSaved.value = (data as LatestTrainingSaved) || null
  } catch (e) {
    console.warn('Failed to load latest training result:', e)
    latestTrainingSaved.value = null
  }
}

// Confirmation wrappers for training result dialog actions
function requestActionConfirm(message: string, action: () => void) {
  requestConfirm(message).then((ok) => {
    if (ok) action()
  })
}

function onTrainingResultClose() {
  requestActionConfirm('Close the training result dialog?', () => {
    trainResultOpen.value = false
  })
}
function onTrainingResultRetry() {
  requestActionConfirm('Discard current training result and start again?', () => {
    trainResultOpen.value = false
    openTrainConfirm()
  })
}
function onTrainingResultConfirmSave() {
  if (!modelTrainResponse.value || modelTrainResponse.value.status !== 'success') return
  requestActionConfirm('Save this trained model result to the database?', () => {
    saveTrainingResultToDb()
  })
}

// Fetch CSV for previously saved training result (view trained model dialog)

function openViewTrained() {
  viewTrainedOpen.value = true
}

function downloadSavedCsv() {
  const path = latestTrainingSaved.value?.csv_path
  if (!path) {
    emit('notify', { text: 'No CSV path available', color: 'error' })
    return
  }
  if (trainedCsvContent.value) {
    const blob = new Blob([trainedCsvContent.value], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = path.split('/').pop() || 'training.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 0)
  } else {
    emit('notify', { text: 'CSV content not loaded; attempting fetch', color: 'info' })
  }
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h3 class="text-h6 text-md-h5 me-3">Programs</h3>
      <v-chip v-if="programs.length" size="small" color="primary" variant="flat">
        {{ programs.length }} total
      </v-chip>
      <v-spacer />
      <v-btn
        size="small"
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
        :disabled="!props.providerId"
      >
        New Program
      </v-btn>
    </div>

    <v-alert v-if="errorMsg" type="error" class="mb-4">{{ errorMsg }}</v-alert>

    <v-skeleton-loader v-if="loading" type="table" />

    <v-table v-else-if="hasPrograms" density="comfortable">
      <thead>
        <tr>
          <th class="text-left">Name</th>
          <th class="text-left">Category</th>
          <th class="text-left">Created</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in programs" :key="p.id">
          <td class="font-weight-medium">{{ p.name }}</td>
          <td>{{ p.category || '—' }}</td>
          <td>{{ p.created_at ? new Date(p.created_at).toLocaleString() : '—' }}</td>
          <td class="text-right">
            <v-btn size="x-small" variant="text" prepend-icon="mdi-pencil" @click="openEdit(p)">
              Edit
            </v-btn>
            <v-btn
              size="x-small"
              variant="text"
              color="error"
              prepend-icon="mdi-delete"
              @click="confirmDelete(p.id)"
            >
              Delete
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-alert v-else type="info" variant="tonal" class="my-6">
      <div class="d-flex align-center">
        <v-icon class="me-2" icon="mdi-view-list-outline" />
        <div>
          <div class="text-subtitle-2">No programs yet</div>
          <div class="text-body-2">Create a program to list its requirements and rules.</div>
        </div>
      </div>
    </v-alert>

    <!-- Program Editor Dialog -->
    <ProgramEditorDialog
      :open="editorOpen"
      :is-edit="isEdit"
      :loading="editorLoading"
      :name="formName"
      :category="formCategory"
      :description="formDescription"
      :requirements="formRequirements"
      :rules="formRules"
      :has-trained-model="!!latestTrainingSaved"
      @update:name="(v) => (formName = v)"
      @update:category="(v) => (formCategory = v)"
      @update:description="(v) => (formDescription = v)"
      @update:requirements="setRequirements"
      @update:rules="setRules"
      @cancel="cancelProgramEditor"
      @save="saveProgram"
      @train="openTrainConfirm()"
      @view-trained="openViewTrained"
    />

    <!-- Program Delete Dialog -->
    <v-dialog v-model="confirmDeleteOpen" max-width="420">
      <v-card>
        <v-card-title class="text-h6">Delete Program</v-card-title>
        <v-card-text>Deleting this program cannot be undone. Continue?</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmDeleteOpen = false">Cancel</v-btn>
          <v-btn color="error" @click="deleteProgram">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Requirement & Rule dialogs moved inside ProgramEditorDialog -->

    <!-- Global Confirm Dialog -->
    <v-dialog v-model="confirmState.show" max-width="420">
      <v-card>
        <v-card-title class="text-h6">Please confirm</v-card-title>
        <v-card-text class="text-wrap">{{ confirmState.message }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmNo">No</v-btn>
          <v-btn color="primary" @click="confirmYes">Yes</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Train Confirm Dialog -->
    <v-dialog v-model="trainConfirmOpen" max-width="640">
      <v-card>
        <v-card-title class="text-h6">Confirm Training</v-card-title>
        <v-card-text class="wrap-content">
          <div class="mb-2">You are about to train with the following rules:</div>
          <v-list density="compact" v-if="formRules.length">
            <v-list-item v-for="(rl, idx) in formRules" :key="idx">
              <v-list-item-title class="wrap-text">
                {{
                  rl.note ||
                  (rl.field ? rl.field + ' ' + (rl.operator || '') + ' ' + (rl.value ?? '') : '—')
                }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="trainConfirmOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="trainRunning" @click="runTrainExtract">Train</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Train Result Dialog (friendly view) -->
    <v-dialog v-model="trainResultOpen" max-width="720">
      <v-card>
        <v-card-title class="text-h6">Training Result</v-card-title>
        <v-card-text class="wrap-content">
          <div v-if="trainResult?.status === 'success'">
            <div class="mb-3">
              <div class="text-subtitle-2 mb-1">Summary</div>
              <div class="wrap-text">{{ trainResult?.rules_text || '—' }}</div>
            </div>
            <div class="mb-3" v-if="trainResult?.rules_for_generator"></div>
            <div class="mb-3" v-if="trainResult?.rules_json?.length">
              <div class="text-subtitle-2 mb-1">Labeled Rules</div>
              <v-list density="compact">
                <v-list-item v-for="(r, i) in trainResult?.rules_json" :key="i">
                  <v-list-item-title class="wrap-text">
                    <strong>{{ r.label }}:</strong> {{ r.rule }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </div>
            <div class="mb-1" v-if="trainResult?.numbered_notes?.length">
              <div class="text-subtitle-2 mb-1">Numbered Notes</div>
              <ol class="ms-4">
                <ol v-for="(n, i) in trainResult?.numbered_notes" :key="i" class="wrap-text">
                  {{
                    n
                  }}
                </ol>
              </ol>
            </div>
            <div class="mb-3" v-if="modelTrainResponse">
              <div class="text-subtitle-2 mb-1">Model Training</div>
              <template v-if="modelTrainResponse.status === 'success'">
                <div class="wrap-text mb-1">
                  Accuracy:
                  <strong> {{ ((modelTrainResponse.accuracy ?? 0) * 100).toFixed(1) }}% </strong>
                </div>
                <div
                  class="wrap-text mb-1"
                  v-if="
                    modelTrainResponse.feature_schema && modelTrainResponse.feature_schema.length
                  "
                >
                  Features: {{ modelTrainResponse.feature_schema.join(', ') }}
                </div>
                <div class="wrap-text mb-1" v-if="modelTrainResponse.file_path">
                  Saved to: {{ modelTrainResponse.file_path }}
                </div>
                <div class="wrap-text mb-2" v-if="modelTrainResponse.csv_path">
                  Data CSV: {{ modelTrainResponse.csv_path }}
                </div>
                <div class="d-flex gap-2 mb-1" v-if="modelTrainResponse.csv">
                  <v-btn size="x-small" variant="tonal" @click="openCsvPreview">Preview CSV</v-btn>
                  <v-btn size="x-small" color="primary" @click="downloadCsv">Download CSV</v-btn>
                </div>
              </template>
              <template v-else>
                <v-alert type="error" variant="tonal" density="compact" class="wrap-text">
                  {{ modelTrainResponse.error || 'Model training failed.' }}
                </v-alert>
              </template>
            </div>
          </div>
          <v-alert v-else type="error" variant="tonal">
            {{ trainResult?.error || 'Training failed. Please try again.' }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="onTrainingResultRetry">Try Again</v-btn>
          <v-btn
            v-if="!modelTrainResponse"
            color="primary"
            :loading="modelTraining"
            @click="runModelTraining()"
            >Confirm & Train Model</v-btn
          >
          <v-btn v-else variant="tonal" color="primary" @click="onTrainingResultConfirmSave">
            Confirm
          </v-btn>
          <v-btn v-if="modelTrainResponse" color="primary" @click="onTrainingResultClose">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- View Trained Model Dialog -->
    <v-dialog v-model="viewTrainedOpen" max-width="720">
      <v-card>
        <v-card-title class="text-h6">Trained Model</v-card-title>
        <v-card-text class="wrap-content">
          <div v-if="latestTrainingSaved">
            <div class="wrap-text mb-1">
              Accuracy:
              <strong>
                {{
                  latestTrainingSaved.accuracy != null
                    ? (latestTrainingSaved.accuracy * 100).toFixed(1) + '%'
                    : '—'
                }}
              </strong>
            </div>
            <div class="wrap-text mb-1" v-if="latestTrainingSaved.features?.length">
              Features: {{ latestTrainingSaved.features.join(', ') }}
            </div>
            <div class="mb-2" v-if="latestTrainingSaved.rules_summary">
              <div class="text-subtitle-2 mb-1">Summary</div>
              <div class="wrap-text">{{ latestTrainingSaved.rules_summary }}</div>
            </div>
            <div class="mb-2" v-if="latestTrainingSaved.notes">
              <div class="text-subtitle-2 mb-1">Notes</div>
              <pre class="wrap-text">{{ latestTrainingSaved.notes }}</pre>
            </div>
            <div class="wrap-text mb-1" v-if="latestTrainingSaved.model_path">
              Model Path: {{ latestTrainingSaved.model_path }}
            </div>
            <div class="wrap-text mb-1" v-if="latestTrainingSaved.csv_path">
              Data CSV: {{ latestTrainingSaved.csv_path }}
            </div>
            <div class="d-flex gap-2 mb-2" v-if="latestTrainingSaved.csv_path"></div>
            <div class="text-caption mt-2">Trained at: {{ latestTrainingSaved.created_at }}</div>
          </div>
          <v-alert v-else type="info" variant="tonal">No training found.</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="tonal"
            color="secondary"
            @click="
              () => {
                viewTrainedOpen = false
                openTrainConfirm()
              }
            "
            >Retrain</v-btn
          >
          <v-btn color="primary" @click="viewTrainedOpen = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- CSV Preview Dialog -->
    <v-dialog v-model="csvPreviewOpen" max-width="840">
      <v-card>
        <v-card-title class="text-h6">Training CSV Preview</v-card-title>
        <v-card-text class="wrap-content">
          <pre class="wrap-text">{{ trainedCsvContent || modelTrainResponse?.csv }}</pre>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="csvPreviewOpen = false">Close</v-btn>
          <v-btn v-if="modelTrainResponse?.csv" color="primary" @click="downloadCsv"
            >Download CSV</v-btn
          >
          <v-btn v-else-if="trainedCsvContent" color="primary" @click="downloadSavedCsv"
            >Download CSV</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.wrap-content {
  max-height: 70vh;
  overflow-y: auto;
}
.wrap-text {
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>
