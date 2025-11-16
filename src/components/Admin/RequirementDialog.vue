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

defineProps<{
  open: boolean
  model: RequirementItem
  requirementTypes: RequirementType[]
  operatorItems: ConditionOperator[]
}>()

const emit = defineEmits(['update:model', 'cancel', 'save'])
</script>

<template>
  <v-dialog :model-value="open" @update:model-value="emit('cancel')" max-width="560">
    <v-card>
      <v-card-title class="text-h6">{{ model?.name ? 'Edit' : 'Add' }} requirement</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" sm="6">
            <v-select
              :items="requirementTypes"
              :model-value="model.type"
              @update:modelValue="(v) => emit('update:model', { ...model, type: v })"
              label="Type"
              required
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              :model-value="model.name"
              @update:modelValue="(v) => emit('update:model', { ...model, name: v })"
              label="Name"
              required
            />
          </v-col>
          <v-col cols="12">
            <v-textarea
              :model-value="model.description || ''"
              @update:modelValue="(v) => emit('update:model', { ...model, description: v })"
              label="Description"
              rows="2"
            />
          </v-col>
          <template v-if="model.type === 'condition'">
            <v-col cols="12" sm="6">
              <v-text-field
                :model-value="model.field_key || ''"
                @update:modelValue="(v) => emit('update:model', { ...model, field_key: v })"
                label="Field key"
                required
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                :items="operatorItems"
                :model-value="model.operator || 'equals'"
                @update:modelValue="(v) => emit('update:model', { ...model, operator: v })"
                label="Operator"
                required
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                :model-value="model.value ?? ''"
                @update:modelValue="(v) => emit('update:model', { ...model, value: v })"
                label="Value"
              />
            </v-col>
          </template>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('cancel')">Cancel</v-btn>
        <v-btn color="primary" @click="emit('save')">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
