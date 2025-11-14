<script setup lang="ts">
import { computed, onMounted, ref, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useProgramsStore } from '../../stores/programs'
const AdminLayout = defineAsyncComponent(() => import('../../layouts/AdminLayout.vue'))
import { useUserStore } from '../../stores/users'
import { providersStore } from '../../stores/providers'
// Use provider logo; no static fallback import to avoid TS asset typing issues
import supabase from '../../lib/Supabase'

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
const displayLogo = computed(() => currentProvider.value?.logo || '')

// Edit dialog state
const showEdit = ref(false)
const editName = ref<string>('')
const logoPreview = ref<string>('')
const logoFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isSaving = ref(false)
const snackbar = ref<{ show: boolean; text: string; color: string }>({
  show: false,
  text: '',
  color: 'success',
})
// Programs for this provider
const programsStore = useProgramsStore()
const router = useRouter()
const myPrograms = computed(() =>
  programsStore.programs.filter((p) => String(p.provider_id) === String(currentProvider.value?.id)),
)

onMounted(async () => {
  if (!programsStore.programs.length) await programsStore.fetchPrograms()
})

function goEdit(programId: string) {
  router.push({ path: '/AdminPrograms', query: { programId } })
}
function goView(programId: string) {
  // For now, reuse edit page as view; could be replaced with a dedicated view route
  router.push({ path: '/AdminPrograms', query: { programId } })
}

// Delete with password confirmation
const deleteDialog = ref(false)
const deleteTargetId = ref<string | null>(null)
const deletePassword = ref('')
const deleting = ref(false)

function requestDelete(id: string) {
  deleteTargetId.value = id
  deletePassword.value = ''
  deleteDialog.value = true
}

async function confirmDeleteProgram() {
  if (!deleteTargetId.value) return
  deleting.value = true
  try {
    // Re-authenticate by asking the user to re-enter their password
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser?.email) throw new Error('No authenticated user')
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: deletePassword.value,
    })
    if (signInError) throw new Error('Invalid password')

    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', deleteTargetId.value)
      .eq('provider_id', currentProvider.value?.id)
    if (error) throw error
    await programsStore.fetchPrograms()
    snackbar.value = { show: true, text: 'Program deleted', color: 'success' }
    deleteDialog.value = false
    deleteTargetId.value = null
    deletePassword.value = ''
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    snackbar.value = { show: true, text: msg || 'Delete failed', color: 'error' }
  } finally {
    deleting.value = false
  }
}
// Reusable confirmation dialog
type ConfirmState = { show: boolean; message: string; resolve?: (v: boolean) => void }
const confirmState = ref<ConfirmState>({ show: false, message: '' })
function requestConfirm(message: string) {
  return new Promise<boolean>((resolve) => {
    confirmState.value = { show: true, message, resolve }
  })
}
function confirmYes() {
  confirmState.value.resolve?.(true)
  confirmState.value.show = false
  confirmState.value.message = ''
}
function confirmNo() {
  confirmState.value.resolve?.(false)
  confirmState.value.show = false
  confirmState.value.message = ''
}

const openEdit = () => {
  if (!currentProvider.value) return
  editName.value = currentProvider.value.agency_name
  logoPreview.value = currentProvider.value.logo || ''
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
    const ok = await requestConfirm('Save changes to agency details?')
    if (!ok) return
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Failed to save edits:', msg)
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

    <!-- Programs grid -->
    <v-row>
      <v-col v-for="p in myPrograms" :key="p.id" cols="12" sm="6" md="4" lg="3" class="d-flex">
        <v-card class="w-100" elevation="6">
          <v-card-title class="text-subtitle-1">{{ p.name }}</v-card-title>
          <v-card-subtitle class="text-caption text-medium-emphasis">
            {{ p.category || 'Program' }}
          </v-card-subtitle>
          <v-card-text>
            <div class="text-caption mb-2">{{ p.description || 'No description' }}</div>
            <hr />
            <div class="text-caption">Requirements: {{ p.requirements?.length || 0 }}</div>
            <div class="text-caption">Rules: {{ p.rules?.length || 0 }}</div>
          </v-card-text>
          <v-card-actions>
            <v-btn variant="text" size="small" prepend-icon="mdi-pencil" @click="goEdit(p.id)"
              >Edit</v-btn
            >
            <v-spacer />
            <v-btn
              color="error"
              variant="text"
              size="small"
              prepend-icon="mdi-delete"
              @click="requestDelete(p.id)"
              >Delete</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col v-if="!myPrograms.length" cols="12" class="py-10">
        <v-empty-state
          headline="No programs yet"
          title="No programs"
          text="Create your first program from the Programs page."
          icon="mdi-view-list-outline"
        />
      </v-col>
    </v-row>
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

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2500">
    {{ snackbar.text }}
  </v-snackbar>

  <!-- Delete Program Dialog -->
  <v-dialog v-model="deleteDialog" max-width="480">
    <v-card>
      <v-card-title class="text-h6">Confirm Delete</v-card-title>
      <v-card-text>
        <div class="mb-3">Please type your password to confirm deletion.</div>
        <v-text-field
          v-model="deletePassword"
          label="Password"
          type="password"
          autocomplete="current-password"
          :disabled="deleting"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="deleting" @click="deleteDialog = false">Cancel</v-btn>
        <v-btn
          color="error"
          :loading="deleting"
          :disabled="!deletePassword"
          @click="confirmDeleteProgram"
          >Delete</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Global Confirm Dialog -->
  <v-dialog v-model="confirmState.show" max-width="420">
    <v-card>
      <v-card-title class="text-h6">Please confirm</v-card-title>
      <v-card-text>{{ confirmState.message }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmNo">No</v-btn>
        <v-btn color="primary" @click="confirmYes">Yes</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
