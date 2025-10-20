<script setup lang="ts">
import { ref, type ComponentPublicInstance } from 'vue'
import type { Program, RequirementItem } from '../../stores/programs'

defineProps<{ program: Program }>()

const uploads = ref<
  Record<string, { name: string; url?: string; uploading: boolean; error?: string }>
>({})

function keyForRequirement(r: RequirementItem, idx: number) {
  return `${r.type}-${r.name}-${idx}`
}

function requirementLabel(r: RequirementItem) {
  if (r.type === 'document') return r.description?.trim() || `Provide ${r.name}`
  const parts = [r.field_key, r.operator, r.value].filter(Boolean)
  return parts.join(' ')
}

const fileRefs = ref<Record<string, HTMLInputElement | null>>({})
function setFileRef(key: string, el: Element | ComponentPublicInstance | null) {
  fileRefs.value[key] = (el as HTMLInputElement) || null
}

async function onFileChange(key: string, e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!uploads.value[key]) uploads.value[key] = { name: '', uploading: false }
  uploads.value[key].name = file.name
  uploads.value[key].uploading = true
  uploads.value[key].error = undefined
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('doc_type', 'printed')
    const res = await fetch('http://localhost:5000/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || res.statusText)
    console.log('OCR result:', data)
  } catch (err: unknown) {
    uploads.value[key].error = err instanceof Error ? err.message : String(err)
  } finally {
    uploads.value[key].uploading = false
  }
}
</script>

<template>
  <v-card class="mx-auto h-100 d-flex flex-column" elevation="8">
    <v-card-title class="py-3">
      <div class="text-subtitle-1 font-weight-medium">{{ program.name }}</div>
      <div class="text-caption text-medium-emphasis">{{ program.category || 'Program' }}</div>
    </v-card-title>
    <v-divider />
    <v-card-text>
      <div v-if="!program.requirements?.length" class="text-caption text-medium-emphasis">
        No requirements listed.
      </div>
      <v-list v-else density="compact" class="py-0">
        <v-list-item
          v-for="(req, idx) in program.requirements"
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
              <v-btn
                size="x-small"
                variant="tonal"
                color="primary"
                :loading="uploads[keyForRequirement(req, idx)]?.uploading"
                @click="fileRefs[keyForRequirement(req, idx)]?.click()"
              >
                {{ uploads[keyForRequirement(req, idx)]?.url ? 'Replace' : 'Upload' }}
              </v-btn>
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

      <v-divider class="my-4" />
      <div class="text-subtitle-2 mb-2">Eligibility Rules</div>
      <div v-if="!program.rules?.length" class="text-caption text-medium-emphasis">
        No rules set.
      </div>
      <v-list v-else density="compact" class="py-0">
        <v-list-item v-for="(r, rIdx) in program.rules" :key="rIdx" class="px-0">
          <v-list-item-title class="text-body-2"
            >{{ r.field }} {{ r.operator }} {{ r.value }}</v-list-item-title
          >
          <v-list-item-subtitle class="text-caption">{{ r.note }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.ga-2 {
  gap: 0.5rem;
}
</style>
