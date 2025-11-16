<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

type RuleItem = { note?: string | null }

defineProps<{
  open: boolean
  model: RuleItem
}>()

const emit = defineEmits<{
  (e: 'update:model', v: RuleItem): void
  (e: 'cancel'): void
  (e: 'save'): void
}>()
</script>

<template>
  <v-dialog :model-value="open" @update:model-value="emit('cancel')" max-width="560">
    <v-card>
      <v-card-title class="text-h6">{{ model?.note ? 'Edit' : 'Add' }} rule</v-card-title>
      <v-card-text>
        <v-text-field
          :model-value="model.note"
          @update:modelValue="(v) => emit('update:model', { ...model, note: v })"
          label="Rule statement"
          placeholder="e.g. You must be a student"
          hide-details="auto"
          autofocus
        />
        <div class="text-caption text-medium-emphasis mt-2">
          Tip: Statements replace field/operator/value.
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('cancel')">Cancel</v-btn>
        <v-btn color="primary" @click="emit('save')">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
