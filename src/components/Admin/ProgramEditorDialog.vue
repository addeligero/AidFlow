<script setup lang="ts">
import { defineProps, defineEmits, ref } from 'vue'

type RequirementType = 'document' | 'condition'

type ConditionOperator =
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
  operator?: ConditionOperator | null
  value?: string | number | boolean | null
}

type RuleItem = {
  field: string
  value: string | number | boolean | null
  note?: string | null
  operator?: ConditionOperator | null
}

const props = defineProps<{
  open: boolean
  isEdit: boolean
  loading: boolean
  name: string
  category: string
  description: string
  requirements: RequirementItem[]
  rules: RuleItem[]
  hasTrainedModel?: boolean
}>()

const emit = defineEmits([
  'update:name',
  'update:category',
  'update:description',
  'update:requirements',
  'update:rules',
  'cancel',
  'save',
  'train',
  'view-trained',
])

function stringifyValue(v: unknown) {
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  return (v as string) ?? ''
}

// Internal dialog state for requirements
const reqDialogOpen = ref(false)
const reqEditIndex = ref<number | null>(null)
const reqModel = ref<RequirementItem>({ type: 'document', name: '', description: '' })

function openAddRequirement() {
  reqEditIndex.value = null
  reqModel.value = { type: 'document', name: '', description: '' }
  reqDialogOpen.value = true
}
function openEditRequirement(idx: number) {
  reqEditIndex.value = idx
  reqModel.value = { ...props.requirements[idx] }
  reqDialogOpen.value = true
}
function confirmSaveRequirement() {
  if (!reqModel.value.name.trim()) return
  if (reqModel.value.type === 'condition') {
    if (!reqModel.value.field_key?.toString().trim() || !reqModel.value.operator) return
  }
  const list = [...props.requirements]
  if (reqEditIndex.value === null) list.push({ ...reqModel.value })
  else list.splice(reqEditIndex.value, 1, { ...reqModel.value })
  emit('update:requirements', list)
  reqDialogOpen.value = false
}
function removeRequirement(idx: number) {
  const list = [...props.requirements]
  list.splice(idx, 1)
  emit('update:requirements', list)
}
function cancelRequirement() {
  const changed = !!reqModel.value.name.trim() || !!reqModel.value.description?.toString().trim()
  if (!changed) {
    reqDialogOpen.value = false
    return
  }
  reqDialogOpen.value = false // Simple discard without global confirm (keeps component self-contained)
}

// Internal dialog state for rules (statement-based)
const ruleDialogOpen = ref(false)
const ruleEditIndex = ref<number | null>(null)
const ruleModel = ref<RuleItem>({ field: '', operator: 'equals', value: '', note: '' })

function openAddRule() {
  ruleEditIndex.value = null
  ruleModel.value = { field: '', operator: 'equals', value: '', note: '' }
  ruleDialogOpen.value = true
}

// Helper setters to avoid TS casts in template
function setReqType(v: string) {
  reqModel.value.type = v as RequirementType
}
function setReqOperator(v: string) {
  reqModel.value.operator = v as ConditionOperator
}
function openEditRule(idx: number) {
  ruleEditIndex.value = idx
  ruleModel.value = { ...props.rules[idx] }
  ruleDialogOpen.value = true
}
function confirmSaveRule() {
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
  const list = [...props.rules]
  if (ruleEditIndex.value === null) list.push(payload)
  else list.splice(ruleEditIndex.value, 1, payload)
  emit('update:rules', list)
  ruleDialogOpen.value = false
}
function removeRule(idx: number) {
  const list = [...props.rules]
  list.splice(idx, 1)
  emit('update:rules', list)
}
function cancelRule() {
  const changed = !!ruleModel.value.note?.toString().trim() || !!ruleModel.value.field.trim()
  if (!changed) {
    ruleDialogOpen.value = false
    return
  }
  ruleDialogOpen.value = false
}
</script>

<template>
  <v-dialog :model-value="open" @update:model-value="emit('cancel')" max-width="720">
    <v-card>
      <v-card-title class="text-h6">{{ isEdit ? 'Edit Program' : 'New Program' }}</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="emit('save')">
          <v-text-field
            :model-value="name"
            @update:modelValue="(v) => emit('update:name', v)"
            label="Program name"
            required
          />
          <v-text-field
            :model-value="category"
            @update:modelValue="(v) => emit('update:category', v)"
            label="Category (optional)"
          />
          <v-textarea
            :model-value="description"
            @update:modelValue="(v) => emit('update:description', v)"
            label="Description"
            rows="3"
          />
          <v-divider class="my-3" />

          <!-- Requirements editor -->
          <br />
          <div class="d-flex align-center mb-2">
            <h4 class="text-subtitle-1 me-2">Requirements</h4>
            <v-spacer />
            <v-btn
              size="x-small"
              color="primary"
              prepend-icon="mdi-plus"
              @click="openAddRequirement()"
            >
              Add requirement
            </v-btn>
          </div>
          <v-table density="compact" class="mb-4">
            <thead>
              <tr>
                <th class="text-left">Type</th>
                <th class="text-left">Name</th>
                <th class="text-left">Details</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!props.requirements.length">
                <td colspan="4" class="text-medium-emphasis">No requirements yet</td>
              </tr>
              <tr v-for="(r, idx) in props.requirements" :key="idx">
                <td>{{ r.type }}</td>
                <td>{{ r.name }}</td>
                <td>
                  <span v-if="r.type === 'document'">{{ r.description || '—' }}</span>
                  <span v-else>
                    {{ r.field_key }} {{ r.operator }} {{ stringifyValue(r.value) }}
                  </span>
                </td>
                <td class="text-right">
                  <v-btn size="x-small" variant="text" @click="openEditRequirement(idx)"
                    >Edit</v-btn
                  >
                  <v-btn
                    size="x-small"
                    variant="text"
                    color="error"
                    @click="removeRequirement(idx)"
                  >
                    Delete
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Rules editor -->
          <br />
          <div class="d-flex align-center mb-2">
            <h4 class="text-subtitle-1 me-2">Guidelines/Eligibility</h4>
            <v-spacer />
            <v-btn size="x-small" color="primary" prepend-icon="mdi-plus" @click="openAddRule()">
              Add
            </v-btn>
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th class="text-left">Created</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!props.rules.length">
                <td colspan="2" class="text-medium-emphasis">No rules yet</td>
              </tr>
              <tr v-for="(rl, rIdx) in props.rules" :key="rIdx">
                <td>
                  <template v-if="rl.field && String(rl.field).trim()">
                    {{ rl.field }} {{ rl.operator }} {{ stringifyValue(rl.value) }}
                    <span v-if="rl.note" class="text-medium-emphasis"> — {{ rl.note }}</span>
                  </template>
                  <template v-else>
                    {{ rl.note || '—' }}
                  </template>
                </td>
                <td class="text-right">
                  <v-btn size="x-small" variant="text" @click="openEditRule(rIdx)">Edit</v-btn>
                  <v-btn size="x-small" variant="text" color="error" @click="removeRule(rIdx)">
                    Delete
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          v-if="!props.hasTrainedModel"
          variant="tonal"
          color="secondary"
          :disabled="!props.rules || props.rules.length === 0"
          @click="emit('train')"
        >
          Train
        </v-btn>
        <v-btn v-else variant="tonal" color="secondary" @click="emit('view-trained')">
          View Trained Model
        </v-btn>
        <v-btn variant="text" @click="emit('cancel')">Cancel</v-btn>
        <v-btn color="primary" :loading="loading" @click="emit('save')">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Requirement Dialog -->
  <v-dialog v-model="reqDialogOpen" max-width="520">
    <v-card>
      <v-card-title class="text-h6">{{
        reqEditIndex === null ? 'Add Requirement' : 'Edit Requirement'
      }}</v-card-title>
      <v-card-text>
        <v-select
          label="Type"
          :items="['document', 'condition']"
          :model-value="reqModel.type"
          @update:modelValue="setReqType"
        />
        <v-text-field
          label="Name"
          :model-value="reqModel.name"
          @update:modelValue="(v) => (reqModel.name = v)"
          required
        />
        <template v-if="reqModel.type === 'document'">
          <v-textarea
            label="Description"
            rows="3"
            :model-value="reqModel.description || ''"
            @update:modelValue="(v) => (reqModel.description = v)"
          />
        </template>
        <template v-else>
          <v-text-field
            label="Field Key"
            :model-value="reqModel.field_key || ''"
            @update:modelValue="(v) => (reqModel.field_key = v)"
          />
          <v-select
            label="Operator"
            :items="[
              'equals',
              'not_equals',
              'less_than',
              'less_or_equal',
              'greater_than',
              'greater_or_equal',
              'includes',
              'exists',
            ]"
            :model-value="reqModel.operator"
            @update:modelValue="setReqOperator"
          />
          <v-text-field
            label="Value"
            :model-value="reqModel.value"
            @update:modelValue="(v) => (reqModel.value = v)"
          />
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancelRequirement">Cancel</v-btn>
        <v-btn color="primary" @click="confirmSaveRequirement">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Rule Dialog -->
  <v-dialog v-model="ruleDialogOpen" max-width="520">
    <v-card>
      <v-card-title class="text-h6">{{
        ruleEditIndex === null ? 'Add Guidelines or eligibility' : 'Edit Guidelines or eligibility'
      }}</v-card-title>
      <v-card-text>
        <v-textarea
          label="Statement (preferred)"
          rows="4"
          :model-value="ruleModel.note || ''"
          @update:modelValue="(v) => (ruleModel.note = v)"
          placeholder="e.g. Applicant must be at least 21 years old"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancelRule">Cancel</v-btn>
        <v-btn color="primary" @click="confirmSaveRule">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
