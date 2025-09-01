<script setup lang="ts">
import { computed } from 'vue'

type Rule = {
  id: string
  rule_name: string
  subsidy_amount: number | null
  conditions: Record<string, any>
  created_at?: string
}

const props = defineProps<{
  rule: Rule
  amountLabel?: string
  conditionsLabel?: string
  emptyConditionsText?: string
}>()

const emit = defineEmits<{
  (e: 'edit', rule: Rule): void
  (e: 'delete', id: string): void
  (e: 'copy', rule: Rule): void
}>()

const totalConditions = computed(() => Object.keys(props.rule.conditions || {}).length)

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
        <v-chip size="x-small" color="secondary" variant="tonal">
          {{ totalConditions }} {{ conditionsLabel || 'conditions' }}
        </v-chip>
        <span class="text-caption text-medium-emphasis ms-auto" v-if="props.rule.created_at">
          {{ new Date(props.rule.created_at).toLocaleString() }}
        </span>
      </v-card-subtitle>
    </v-card-item>

    <v-divider />
    <v-card-text>
      <div v-if="totalConditions">
        <v-table density="compact">
          <thead>
            <tr>
              <th class="text-caption text-medium-emphasis">Condition</th>
              <th class="text-caption text-medium-emphasis">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(val, key) in props.rule.conditions" :key="key">
              <td class="text-body-2 font-weight-medium">{{ key }}</td>
              <td class="text-body-2">{{ val }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>
      <div v-else class="text-caption text-medium-emphasis">
        {{ emptyConditionsText || 'No conditions defined.' }}
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
