<script setup lang="ts">
import { ref, computed } from 'vue'

import { useUserStore } from '@/stores/users'

type Rule = {
  id: string
  rule_name: string
  conditions: Record<string, any>
  subsidy_amount?: number
  provider?: { agency_name?: string }
}

const props = defineProps<{
  rule: Rule
  Title?: string
  Subtitle?: string
}>()

const userStore = useUserStore()
if (!userStore.isUserLoaded) {
  userStore.fetchUser()
}

// Derive requirements gikan sa conditions
const requirements = computed(() => {
  if (!props.rule?.conditions) return [] as string[]
  return Object.keys(props.rule.conditions || {})
})

// Track uploads per requirement
const uploads = ref<
  Record<string, { name: string; url?: string; uploading: boolean; error?: string }>
>({})

const initRequirement = (req: string) => {
  if (!uploads.value[req]) uploads.value[req] = { name: '', uploading: false }
}

const titleText = computed(() => props.Title || props.rule.rule_name)
const subtitleText = computed(
  () =>
    props.Subtitle ||
    (props.rule.provider?.agency_name
      ? `Provided by ${props.rule.provider.agency_name}`
      : 'Required Documents'),
)

// Handle file change + OCR API call
const onFileChange = async (req: string, e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  initRequirement(req)
  uploads.value[req].name = file.name
  uploads.value[req].uploading = true
  uploads.value[req].error = undefined

  try {
    const fd = new FormData()
    fd.append('file', file)
    // printed pa ang n aa
    fd.append('doc_type', 'printed')

    // Call OCR API
    const res = await fetch('http://localhost:5000/upload', {
      method: 'POST',
      body: fd,
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || res.statusText)

    // OCR result
    console.log(`OCR result for ${req}:`, data)

    // (Optional) If you also want to store the file in Supabase
    // const { data: uploadData, error } = await supabase.storage
    //   .from('uploads')
    //   .upload(`requirements/${req}-${Date.now()}-${file.name}`, file)
    // if (error) throw error
    // uploads.value[req].url = supabase.storage.from('uploads').getPublicUrl(uploadData.path).publicUrl
  } catch (err: any) {
    uploads.value[req].error = err.message
    console.error(`Error OCR for ${req}:`, err)
  } finally {
    uploads.value[req].uploading = false
  }
}
</script>

<template>
  <v-card class="mx-auto h-100 d-flex flex-column" elevation="8">
    <v-card-title class="py-3">
      <div class="text-subtitle-1 font-weight-medium">{{ titleText }}</div>
      <div class="text-caption text-medium-emphasis">{{ subtitleText }}</div>
    </v-card-title>
    <v-divider />
    <v-card-text class="flex-grow-1">
      <div v-if="!requirements.length" class="text-caption text-medium-emphasis">
        No requirements listed.
      </div>
      <v-list v-else density="compact" class="py-0">
        <v-list-item v-for="req in requirements" :key="req" class="px-0">
          <template #prepend>
            <v-avatar size="28" color="primary" variant="tonal" class="me-2">
              <v-icon size="18" icon="mdi-file-document" />
            </v-avatar>
          </template>
          <v-list-item-title class="text-body-2">{{ req }}</v-list-item-title>
          <template #append>
            <div class="d-flex align-center ga-2">
              <v-btn
                size="x-small"
                variant="tonal"
                color="primary"
                :loading="uploads[req]?.uploading"
                @click="($refs[`input-${req}`] as HTMLInputElement[])[0].click()"
              >
                {{ uploads[req]?.url ? 'Replace' : 'Upload' }}
              </v-btn>
              <v-icon v-if="uploads[req]?.url" size="18" color="success" icon="mdi-check-circle" />
            </div>
            <input
              class="d-none"
              :ref="`input-${req}`"
              type="file"
              accept="image/*,application/pdf"
              @change="onFileChange(req, $event)"
            />
          </template>
          <v-list-item-subtitle v-if="uploads[req]?.name" class="text-caption mt-1">
            <span v-if="uploads[req]?.error" class="text-error">{{ uploads[req].error }}</span>
            <template v-else>
              {{ uploads[req].name }}
              <v-btn
                v-if="uploads[req]?.url"
                :href="uploads[req].url"
                target="_blank"
                size="x-small"
                variant="text"
                icon="mdi-open-in-new"
              />
            </template>
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card-text>
    <v-divider />
    <v-card-actions class="py-3 justify-end">
      <v-chip v-if="rule.subsidy_amount" size="x-small" color="primary" variant="tonal">
        Subsidy: {{ rule.subsidy_amount }}
      </v-chip>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.ga-2 {
  gap: 0.5rem;
}
</style>
