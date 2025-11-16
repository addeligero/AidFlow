<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, defineAsyncComponent } from 'vue'
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

const programs = ref<Program[]>([])
const loading = ref(false)
const errorMsg = ref('')

const editorOpen = ref(false)
const editorLoading = ref(false)
const isEdit = ref(false)
const currentId = ref<string | null>(null)
const formName = ref('')
const formCategory = ref('')
const formDescription = ref('')

// Structured editors: requirement and rule items
type RequirementType = 'document' | 'condition'
type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'less_than'
  | 'less_or_equal'
  | 'greater_than'
  | 'greater_or_equal'
  | 'includes'
  | 'exists'

type RequirementItem = {
  type: RequirementType
  name: string
  description?: string | null
  field_key?: string | null
  operator?: RuleOperator | null
  value?: string | number | boolean | null
}

type RuleItem = {
  field: string
  operator: RuleOperator
  value: string | number | boolean | null
  note?: string | null
}

const formRequirements = ref<RequirementItem[]>([])
const formRules = ref<RuleItem[]>([])

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
    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', toDeleteId.value)
      .eq('provider_id', props.providerId)
    if (error) throw error
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
      const { error } = await supabase.from('programs').update(payload).eq('id', currentId.value)
      if (error) throw error
      emit('notify', { text: 'Program updated' })
    } else {
      const { error } = await supabase.from('programs').insert([payload])
      if (error) throw error
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
    programs.value = []
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const { data, error } = await supabase
      .from('programs')
      .select(
        'id, provider_id, name, category, description, requirements, rules, created_at, updated_at',
      )
      .eq('provider_id', props.providerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    type RowProgram = {
      id: string | number
      provider_id: string | number
      name: string
      category?: string | null
      description?: string | null
      requirements?: unknown[] | null
      rules?: unknown[] | null
      created_at?: string
      updated_at?: string
    }
    programs.value = ((data || []) as RowProgram[]).map((row) => ({
      id: String(row.id),
      provider_id: row.provider_id,
      name: row.name,
      category: row.category,
      description: row.description,
      requirements: row.requirements ?? [],
      rules: row.rules ?? [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    })) as Program[]
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    errorMsg.value = msg
    programs.value = []
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
      programs.value = []
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
const requirementTypes: RequirementType[] = ['document', 'condition']
const ruleOperators: RuleOperator[] = [
  'equals',
  'not_equals',
  'less_than',
  'less_or_equal',
  'greater_than',
  'greater_or_equal',
  'includes',
  'exists',
]

function isRequirementType(v: unknown): v is RequirementType {
  return v === 'document' || v === 'condition'
}
function asRequirementType(v: unknown): RequirementType {
  return isRequirementType(v) ? v : 'document'
}
function isRuleOperator(v: unknown): v is RuleOperator {
  return (
    v === 'equals' ||
    v === 'not_equals' ||
    v === 'less_than' ||
    v === 'less_or_equal' ||
    v === 'greater_than' ||
    v === 'greater_or_equal' ||
    v === 'includes' ||
    v === 'exists'
  )
}
function asRuleOperator(v: unknown): RuleOperator {
  return isRuleOperator(v) ? v : 'equals'
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
    operator: r.operator ? asRuleOperator(r.operator) : null,
    value: (value as string | number | boolean | null | undefined) ?? null,
  }
}

function toRuleItem(raw: unknown): RuleItem {
  const r = (raw ?? {}) as Record<string, unknown>
  const value = (r as Record<string, unknown>)['value']
  return {
    field: asString(r.field),
    operator: asRuleOperator(r.operator),
    value: (value as string | number | boolean | null | undefined) ?? null,
    note: (typeof r.note === 'string' ? r.note : null) as string | null,
  }
}

// stringifyValue no longer used in parent after extracting editor

// Requirement dialog state and actions
const reqDialogOpen = ref(false)
const reqEditIndex = ref<number | null>(null)
const reqModel = ref<RequirementItem>({ type: 'document', name: '', description: '' })

function openReqDialog() {
  reqEditIndex.value = null
  reqModel.value = { type: 'document', name: '', description: '' }
  reqDialogOpen.value = true
}
function editReq(index: number) {
  reqEditIndex.value = index
  reqModel.value = { ...formRequirements.value[index] }
  reqDialogOpen.value = true
}
function removeReq(index: number) {
  requestConfirm('Remove this requirement?').then((ok) => {
    if (ok) formRequirements.value.splice(index, 1)
  })
}
function saveReq() {
  if (!reqModel.value.name.trim()) return
  if (reqModel.value.type === 'condition') {
    if (!reqModel.value.field_key?.toString().trim() || !reqModel.value.operator) return
  }
  const payload: RequirementItem = { ...reqModel.value }
  const isAdding = reqEditIndex.value === null
  const msg = isAdding ? 'Add this requirement?' : 'Save changes to this requirement?'
  requestConfirm(msg).then((ok) => {
    if (!ok) return
    if (isAdding) formRequirements.value.push(payload)
    else formRequirements.value.splice(reqEditIndex.value as number, 1, payload)
    reqDialogOpen.value = false
  })
}

function cancelReqDialog() {
  const changed =
    !!reqModel.value.name.trim() ||
    !!reqModel.value.description?.toString().trim() ||
    !!reqModel.value.field_key?.toString().trim()
  if (!changed) {
    reqDialogOpen.value = false
    return
  }
  requestConfirm('Discard requirement changes?').then((ok) => {
    if (ok) reqDialogOpen.value = false
  })
}

// Rule dialog state and actions
const ruleDialogOpen = ref(false)
const ruleEditIndex = ref<number | null>(null)
const ruleModel = ref<RuleItem>({ field: '', operator: 'equals', value: '', note: '' })

function openRuleDialog() {
  ruleEditIndex.value = null
  ruleModel.value = { field: '', operator: 'equals', value: '', note: '' }
  ruleDialogOpen.value = true
}
function editRule(index: number) {
  ruleEditIndex.value = index
  ruleModel.value = { ...formRules.value[index] }
  ruleDialogOpen.value = true
}
function removeRule(index: number) {
  requestConfirm('Remove this rule?').then((ok) => {
    if (ok) formRules.value.splice(index, 1)
  })
}
function saveRule() {
  // Accept statement-only rule via note; ignore structured fields if empty
  const hasStatement = !!ruleModel.value.note && !!ruleModel.value.note.toString().trim()
  const hasStructured = !!ruleModel.value.field.trim() && !!ruleModel.value.operator
  if (!hasStatement && !hasStructured) return
  const payload: RuleItem = hasStatement
    ? {
        field: '',
        operator: 'equals',
        value: null,
        note: ruleModel.value.note?.toString().trim() || '',
      }
    : { ...ruleModel.value }
  const isAdding = ruleEditIndex.value === null
  const msg = isAdding ? 'Add this rule?' : 'Save changes to this rule?'
  requestConfirm(msg).then((ok) => {
    if (!ok) return
    if (isAdding) formRules.value.push(payload)
    else formRules.value.splice(ruleEditIndex.value as number, 1, payload)
    ruleDialogOpen.value = false
  })
}

function cancelRuleDialog() {
  const changed = !!ruleModel.value.note?.toString().trim() || !!ruleModel.value.field.trim()
  if (!changed) {
    ruleDialogOpen.value = false
    return
  }
  requestConfirm('Discard rule changes?').then((ok) => {
    if (ok) ruleDialogOpen.value = false
  })
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

    <ProgramEditorDialog
      :open="editorOpen"
      :is-edit="isEdit"
      :loading="editorLoading"
      :name="formName"
      :category="formCategory"
      :description="formDescription"
      :requirements="formRequirements"
      :rules="formRules"
      @update:name="(v) => (formName = v)"
      @update:category="(v) => (formCategory = v)"
      @update:description="(v) => (formDescription = v)"
      @add-req="openReqDialog()"
      @edit-req="editReq"
      @delete-req="removeReq"
      @add-rule="openRuleDialog()"
      @edit-rule="editRule"
      @delete-rule="removeRule"
      @cancel="cancelProgramEditor"
      @save="saveProgram"
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

    <!-- Requirement Dialog -->
    <v-dialog v-model="reqDialogOpen" max-width="560">
      <v-card>
        <v-card-title class="text-h6"
          >{{ reqEditIndex === null ? 'Add' : 'Edit' }} requirement</v-card-title
        >
        <v-card-text>
          <v-row>
            <v-col cols="12" sm="6">
              <v-select :items="requirementTypes" v-model="reqModel.type" label="Type" required />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="reqModel.name" label="Name" required />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="reqModel.description" label="Description" rows="2" />
            </v-col>
            <template v-if="reqModel.type === 'condition'">
              <v-col cols="12" sm="6">
                <v-text-field v-model="reqModel.field_key" label="Field key" required />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  :items="ruleOperators"
                  v-model="reqModel.operator"
                  label="Operator"
                  required
                />
              </v-col>
              <v-col cols="12">
                <v-text-field v-model="reqModel.value" label="Value" />
              </v-col>
            </template>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cancelReqDialog">Cancel</v-btn>
          <v-btn color="primary" @click="saveReq">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Rule Dialog (statement-based) -->
    <v-dialog v-model="ruleDialogOpen" max-width="560">
      <v-card>
        <v-card-title class="text-h6"
          >{{ ruleEditIndex === null ? 'Add' : 'Edit' }} rule</v-card-title
        >
        <v-card-text>
          <v-text-field
            v-model="ruleModel.note"
            label="Rule statement"
            placeholder="e.g. You must be a student"
            hide-details="auto"
            autofocus
          />
          <div class="text-caption text-medium-emphasis mt-2">
            Tip: Statements replace field/operator/value. Leave them blank.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cancelRuleDialog">Cancel</v-btn>
          <v-btn color="primary" @click="saveRule">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Global Confirm Dialog -->
    <v-dialog v-model="confirmState.show" max-width="420">
      <v-card>
        <v-card-title class="text-h6">Please confirm</v-card-title>
        <v-card-text>{{ confirmState.message }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmNo">No</v-btn>
          <v-btn color="primary" @click="confirmYes">Yes</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
