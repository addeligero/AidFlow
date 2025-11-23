<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue'
import type { Program, RequirementItem, RuleItem } from '../../stores/programs'

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const props = defineProps<{
  program: Program
  uploads: Record<string, { name: string; uploading: boolean; submitted?: boolean }>
  existingDocs: Record<string, unknown>
  mappingLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'open-upload', key: string): void
  (e: 'open-existing', key: string): void
  (e: 'file-selected', key: string, file: File): void
  (e: 'predict'): void
  (e: 'view-program'): void
}>()

const showAllReqs = ref(false)
const showAllRules = ref(false)

function keyForRequirement(r: RequirementItem, idx: number) {
  return `${r.type}-${r.name}-${idx}`
}

function requirementLabel(r: RequirementItem) {
  if (r.type === 'document') return r.description?.trim() || `Provide ${r.name}`
  if ((r as unknown as { type?: string }).type === 'input') {
    return r.description?.toString().trim() || `Please provide ${r.name}`
  }
  const parts = [r.field_key, r.operator, r.value].filter(Boolean)
  return parts.join(' ')
}

const visibleRequirements = computed(() => {
  const list = (props.program.requirements || []) as RequirementItem[]
  return showAllReqs.value ? list : list.slice(0, 2)
})
const visibleRules = computed(() => {
  const list = (props.program.rules || []) as RuleItem[]
  return showAllRules.value ? list : list.slice(0, 2)
})

const fileInputs = ref<Record<string, HTMLInputElement | null>>({})
function setFileRef(key: string, el: Element | null) {
  fileInputs.value[key] = (el as HTMLInputElement) || null
}
function triggerFilePicker(key: string) {
  fileInputs.value[key]?.click()
}
function onFileChange(key: string, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('file-selected', key, file)
}

defineExpose({ triggerFilePicker })
</script>

<template>
  <v-card v-bind="attrs" class="mx-auto h-100 d-flex flex-column" elevation="8">
    <v-card-title class="py-3 d-flex align-center">
      <div>
        <div class="text-subtitle-1 font-weight-medium">{{ program.name }}</div>
        <div class="text-caption text-medium-emphasis">{{ program.category || 'Program' }}</div>
      </div>
      <v-spacer />
      <v-btn size="small" variant="text" @click="emit('view-program')">View</v-btn>
    </v-card-title>
    <v-divider />
    <v-card-text>
      <div v-if="!program.requirements?.length" class="text-caption text-medium-emphasis">
        No requirements listed.
      </div>
      <v-list v-else density="compact" class="py-0">
        <v-list-item
          v-for="(req, idx) in visibleRequirements"
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
                  @click="emit('open-existing', keyForRequirement(req, idx))"
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
                  @click="emit('open-upload', keyForRequirement(req, idx))"
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
      <div
        v-if="(program.requirements?.length || 0) > 2 && !showAllReqs"
        class="text-medium-emphasis text-caption mt-1"
      >
        ...
      </div>
      <div v-if="(program.requirements?.length || 0) > 2" class="mt-2 d-flex justify-end">
        <v-btn size="x-small" variant="text" @click="showAllReqs = !showAllReqs">
          {{ showAllReqs ? 'Show less' : 'View all requirements' }}
        </v-btn>
      </div>

      <!-- Predict Eligibility Button -->
      <div class="mt-4 d-flex justify-end">
        <v-btn color="primary" :loading="mappingLoading" @click="emit('predict')">
          Predict Eligibility
        </v-btn>
      </div>

      <v-divider class="my-4" />
      <div class="text-subtitle-2 mb-2">Eligibility Rules</div>
      <div v-if="!program.rules?.length" class="text-caption text-medium-emphasis">
        No rules set.
      </div>
      <v-list v-else density="compact" class="py-0">
        <v-list-item v-for="(r, rIdx) in visibleRules" :key="rIdx" class="px-0">
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
      <div
        v-if="(program.rules?.length || 0) > 2 && !showAllRules"
        class="text-caption mt-1 text-medium-emphasis"
      >
        ...
      </div>
      <div v-if="(program.rules?.length || 0) > 2" class="mt-2 d-flex justify-end">
        <v-btn size="x-small" variant="text" @click="showAllRules = !showAllRules">
          {{ showAllRules ? 'Show less' : 'View all rules' }}
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
  <!-- Dialogs removed; handled by ClientProgram.vue -->
</template>

<style scoped>
.ga-2 {
  gap: 0.5rem;
}
</style>

<style scoped>
:deep(.requirement-subtitle) {
  white-space: normal;
}
</style>
