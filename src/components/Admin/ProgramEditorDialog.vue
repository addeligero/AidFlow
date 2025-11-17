<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

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

defineProps<{
  open: boolean
  isEdit: boolean
  loading: boolean
  name: string
  category: string
  description: string
  requirements: RequirementItem[]
  rules: RuleItem[]
}>()

const emit = defineEmits([
  'update:name',
  'update:category',
  'update:description',
  'add-req',
  'edit-req',
  'remove-req',
  'add-rule',
  'edit-rule',
  'remove-rule',
  'cancel',
  'save',
  'train',
])

function stringifyValue(v: unknown) {
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  return (v as string) ?? ''
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
          <div class="d-flex align-center mb-2">
            <h4 class="text-subtitle-1 me-2">Requirements</h4>
            <v-spacer />
            <v-btn size="x-small" color="primary" prepend-icon="mdi-plus" @click="emit('add-req')">
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
              <tr v-if="!requirements.length">
                <td colspan="4" class="text-medium-emphasis">No requirements yet</td>
              </tr>
              <tr v-for="(r, idx) in requirements" :key="idx">
                <td>{{ r.type }}</td>
                <td>{{ r.name }}</td>
                <td>
                  <span v-if="r.type === 'document'">{{ r.description || '—' }}</span>
                  <span v-else>
                    {{ r.field_key }} {{ r.operator }} {{ stringifyValue(r.value) }}
                  </span>
                </td>
                <td class="text-right">
                  <v-btn size="x-small" variant="text" @click="emit('edit-req', idx)">Edit</v-btn>
                  <v-btn
                    size="x-small"
                    variant="text"
                    color="error"
                    @click="emit('remove-req', idx)"
                  >
                    Delete
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Rules editor -->
          <div class="d-flex align-center mb-2">
            <h4 class="text-subtitle-1 me-2">Rules</h4>
            <v-spacer />
            <v-btn size="x-small" color="primary" prepend-icon="mdi-plus" @click="emit('add-rule')">
              Add rule
            </v-btn>
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th class="text-left">Rule</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!rules.length">
                <td colspan="2" class="text-medium-emphasis">No rules yet</td>
              </tr>
              <tr v-for="(rl, rIdx) in rules" :key="rIdx">
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
                  <v-btn size="x-small" variant="text" @click="emit('edit-rule', rIdx)">Edit</v-btn>
                  <v-btn
                    size="x-small"
                    variant="text"
                    color="error"
                    @click="emit('remove-rule', rIdx)"
                  >
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
          variant="tonal"
          color="secondary"
          :disabled="!rules || rules.length === 0"
          @click="emit('train')"
        >
          Train
        </v-btn>
        <v-btn variant="text" @click="emit('cancel')">Cancel</v-btn>
        <v-btn color="primary" :loading="loading" @click="emit('save')">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
