<script setup lang="ts">
import { computed } from 'vue'

type Requirement = {
  id: string
  name: string
  field_key: string
  operator: string
  value: string
  description?: string | null
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
        <div v-for="req in props.rule.requirements" :key="req.id" class="rounded pa-3 requirement-card">
          <div class="d-flex align-center mb-1">
            <v-icon size="18" color="primary" class="me-2">mdi-file-document</v-icon>
            <div class="text-body-2 font-weight-medium">{{ req.name }}</div>
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ req.field_key }}
            <strong>{{ ' ' + req.operator + ' ' }}</strong>
            {{ req.value }}
          </div>
          <div v-if="req.description" class="text-caption mt-1">{{ req.description }}</div>
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
