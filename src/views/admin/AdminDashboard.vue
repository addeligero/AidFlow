<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AdminCard from '@/components/Admin/AdminCard.vue'
import DashboardChart from '@/views/admin/DashboardChart.vue'
import { useUserStore } from '@/stores/users'
import { providersStore } from '@/stores/providers'
import defaultlogo from '@/assets/img/logo/defaultlogo.jp.jpg'
import supabase from '@/lib/Supabase'

const userStore = useUserStore()
const provStore = providersStore()

onMounted(async () => {
  if (!userStore.isUserLoaded) await userStore.fetchUser()
  if (!provStore.providers.length) await provStore.fetchProviders()
})

const currentProvider = computed(() => {
  const uid = userStore.user_id
  if (!uid) return null
  return provStore.providers.find((p) => String(p.id) === String(uid)) || null
})

const displayName = computed(() => currentProvider.value?.program || userStore.userFullName)
const displayAgency = computed(() => currentProvider.value?.agency_name || userStore.userFullName)
const displayLogo = computed(() => currentProvider.value?.logo || (defaultlogo as string))

// Edit dialog state
const showEdit = ref(false)
const editName = ref<string>('')
const logoPreview = ref<string>('')
const logoFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isSaving = ref(false)

const openEdit = () => {
  if (!currentProvider.value) return
  editName.value = currentProvider.value.agency_name
  logoPreview.value = currentProvider.value.logo || (defaultlogo as string)
  logoFile.value = null
  showEdit.value = true
}

const onLogoChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  logoFile.value = file
  const reader = new FileReader()
  reader.onload = () => (logoPreview.value = reader.result as string)
  reader.readAsDataURL(file)
}

const saveEdits = async () => {
  if (!currentProvider.value) return
  isSaving.value = true
  try {
    let logoUrl = currentProvider.value.logo || ''
    if (logoFile.value) {
      const ext = logoFile.value.name.split('.').pop()
      const fileName = `${currentProvider.value.id}-${Date.now()}.${ext}`
      const filePath = `provider-logos/${fileName}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, logoFile.value, { upsert: true })
      if (uploadError) throw uploadError
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      logoUrl = publicUrlData.publicUrl
    }

    const { error: updateError } = await supabase
      .from('providers')
      .update({ agency_name: editName.value, logo: logoUrl })
      .eq('id', currentProvider.value.id)
    if (updateError) throw updateError

    await provStore.fetchProviders()
    showEdit.value = false
  } catch (e: any) {
    console.error('Failed to save edits:', e?.message || e)
  } finally {
    isSaving.value = false
  }
}
</script>
<template>
  <AdminLayout>
    <v-card
      class="mb-4 pa-4 d-flex align-center justify-space-between border-md"
      rounded="lg"
      elevation="8"
    >
      <div class="d-flex align-center">
        <v-avatar size="64" class="mr-4">
          <v-img :src="displayLogo" alt="Admin logo" cover />
        </v-avatar>
        <div>
          <h2 class="text-h6 text-md-h5 mb-1">{{ displayName }}</h2>
          <div class="text-caption text-medium-emphasis">under {{ displayAgency }}</div>
        </div>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-pencil"
        :disabled="!currentProvider"
        @click="openEdit"
        >Edit</v-btn
      >
    </v-card>

    <DashboardChart />
    <br />
    <hr />
    <br />
    <AdminCard
      title="Programs"
      subHeader="Empower Your Community"
      shortStatement="Click below to add or update your community guidelines."
      buttonText="View Programs Here"
    />
  </AdminLayout>

  <!-- Edit Provider Dialog -->
  <v-dialog v-model="showEdit" max-width="520">
    <v-card>
      <v-card-title class="text-h6">Edit agency</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="saveEdits">
          <v-text-field v-model="editName" label="Agency name" required />
          <div class="d-flex align-center mb-3">
            <v-avatar size="72" class="mr-3">
              <v-img :src="logoPreview || displayLogo" alt="Logo preview" cover />
            </v-avatar>
            <div>
              <v-btn variant="tonal" @click="fileInputRef?.click()" prepend-icon="mdi-image"
                >Choose logo</v-btn
              >
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                class="d-none"
                @change="onLogoChange"
              />
            </div>
          </div>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="showEdit = false">Cancel</v-btn>
        <v-btn color="primary" :loading="isSaving" @click="saveEdits">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
