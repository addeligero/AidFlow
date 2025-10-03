<script setup lang="ts">
import { computed } from 'vue'

type RequirementExtra = Record<string, any> | null

type Requirement = {
  id: string
  name: string
  type: 'document' | 'condition'
  field_key?: string | null
  operator?: string | null
  value?: string | null
  description?: string | null
  extra?: RequirementExtra
}

type Rule = {
  id: string
  rule_name: string
  description?: string | null
  subsidy_amount: number | null
  classification?: string | null
  created_at?: string
  requirements: Requirement[]
}

const props = defineProps<{
  rule: Rule
  amountLabel?: string
  requirementsLabel?: string
  emptyRequirementsText?: string
}>()

const emit = defineEmits<{
  (e: 'edit', rule: Rule): void
  (e: 'delete', id: string): void
  (e: 'copy', rule: Rule): void
}>()

const totalRequirements = computed(() => props.rule.requirements?.length || 0)

const operatorLabels: Record<string, string> = {
  equals: 'Equals',
  not_equals: 'Not Equals',
  greater_than: 'Greater Than',
  greater_or_equal: 'Greater or Equal',
  less_than: 'Less Than',
  less_or_equal: 'Less or Equal',
  contains: 'Contains',
}

const formatOperator = (operator?: string | null) => {
  if (!operator) return ''
  return operatorLabels[operator] || operator.replace(/_/g, ' ')
}

const extractRequirementNote = (extra?: RequirementExtra) => {
  if (!extra) return null
  if (typeof extra === 'string') return extra
  if (typeof extra === 'object') {
    const candidate = extra.note || extra.instructions || extra.details || extra.detail
    if (candidate) return String(candidate)
  }
  try {
    return JSON.stringify(extra)
  } catch (e) {
    return null
  }
}

const requirementDetails = (req: Requirement) => {
  if (req.type === 'document') {
    return req.description?.trim() || extractRequirementNote(req.extra) || 'Provide this document.'
  }
  const field = req.field_key?.trim() || 'value'
  const operator = formatOperator(req.operator)
  const value = (req.value ?? '').toString().trim()
  return [field, operator, value].filter(Boolean).join(' ').trim()
}

function onEdit() {
  emit('edit', props.rule)
}
function onDelete() {
  emit('delete', props.rule.id)
}
function onCopy() {
  emit('copy', props.rule)
}
</script>

<template>
  <v-card class="flex-grow-1 d-flex flex-column" :title="props.rule.rule_name">
    <v-card-item>
      <v-card-title class="text-subtitle-1">{{ props.rule.rule_name }}</v-card-title>
      <v-card-subtitle class="d-flex align-center flex-wrap ga-2">
        <v-chip size="x-small" color="primary" variant="flat">
          {{ amountLabel || 'Amount' }}: {{ props.rule.subsidy_amount ?? '—' }}
        </v-chip>
        <v-chip v-if="props.rule.classification" size="x-small" color="secondary" variant="tonal">
          {{ props.rule.classification }}
        </v-chip>
        <v-chip size="x-small" color="info" variant="tonal">
          {{ totalRequirements }} {{ requirementsLabel || 'requirements' }}
        </v-chip>
        <span class="text-caption text-medium-emphasis ms-auto" v-if="props.rule.created_at">
          {{ new Date(props.rule.created_at).toLocaleString() }}
        </span>
      </v-card-subtitle>
    </v-card-item>

    <v-divider />
    <v-card-text class="d-flex flex-column ga-3">
      <div v-if="props.rule.description" class="text-body-2">
        {{ props.rule.description }}
      </div>

      <div v-if="totalRequirements" class="d-flex flex-column ga-3">
        <div
          v-for="req in props.rule.requirements"
          :key="req.id"
          class="rounded pa-3 requirement-card"
        >
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="d-flex align-center">
              <v-icon size="18" color="primary" class="me-2">
                {{ req.type === 'document' ? 'mdi-file-document' : 'mdi-tune-variant' }}
              </v-icon>
              <div class="text-body-2 font-weight-medium">{{ req.name }}</div>
            </div>
            <v-chip size="x-small" variant="outlined" color="primary">
              {{ req.type === 'document' ? 'Document' : 'Condition' }}
            </v-chip>
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ requirementDetails(req) }}
          </div>
          <div v-if="req.type === 'condition' && req.description" class="text-caption mt-1">
            {{ req.description }}
          </div>
          <div
            v-if="req.type === 'document' && extractRequirementNote(req.extra)"
            class="text-caption mt-1"
          >
            {{ extractRequirementNote(req.extra) }}
          </div>
        </div>
      </div>
      <div v-else class="text-caption text-medium-emphasis">
        {{ emptyRequirementsText || 'No requirements linked yet.' }}
      </div>
    </v-card-text>

    <v-divider />
    <v-card-actions>
      <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-pencil" @click="onEdit">
        Edit
      </v-btn>
      <v-btn size="small" variant="text" color="error" prepend-icon="mdi-delete" @click="onDelete">
        Delete
      </v-btn>
      <v-spacer />
      <v-tooltip text="Copy JSON" location="top">
        <template #activator="{ props: p }">
          <v-btn v-bind="p" icon size="small" @click="onCopy">
            <v-icon size="18">mdi-content-copy</v-icon>
          </v-btn>
        </template>
      </v-tooltip>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.requirement-card {
  background: rgba(var(--v-theme-surface-variant), 0.45);
  border: 1px solid rgba(var(--v-border-color), 0.08);
  backdrop-filter: blur(4px);
}
</style>
