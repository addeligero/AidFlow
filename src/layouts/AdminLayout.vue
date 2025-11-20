<script setup lang="ts">
import { useTheme, useDisplay } from 'vuetify'
import { ref, computed, onMounted } from 'vue'
import { providersStore } from '../stores/providers'
import { useUserStore } from '../stores/users'
import supabase from '../lib/Supabase'

const ps = providersStore()
const user = useUserStore()
const drawer = ref(true)
const { mdAndDown } = useDisplay()

const theme = useTheme()
const savedTheme = localStorage.getItem('theme')
if (savedTheme) {
  theme.global.name.value = savedTheme
}
function onClick() {
  const newTheme = theme.global.name.value === 'light' ? 'dark' : 'light'
  theme.global.name.value = newTheme
  localStorage.setItem('theme', newTheme)
}

// Avatar handling
const showAvatarDialog = ref(false)
const selectedImage = ref(user.userProfileImg || 'https://randomuser.me/api/portraits/women/85.jpg')
const fileInputRef = ref<HTMLInputElement | null>(null)

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    selectedImage.value = reader.result as string
  }
  reader.readAsDataURL(file)

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) {
    console.error('No authenticated user found')
    return
  }

  // Upload to Supabase Storage
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `admin-profile/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    console.error('Upload failed:', uploadError.message)
    return
  }

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
  const publicUrl = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from('users')
    .update({ img: publicUrl })
    .eq('user_id', userId)

  if (updateError) {
    console.error('Failed to update user image:', updateError.message)
    return
  }

  selectedImage.value = publicUrl
}

// Super admin nav visibility
onMounted(async () => {
  if (!user.isUserLoaded) {
    await user.fetchUser()
  }
  if (ps.providers.length === 0) {
    await ps.fetchProviders()
  }
})

const isSuperAdmin = computed(() => {
  const me = ps.providers.find((p) => p.id === user.user_id)
  return !!me?.is_super_admin
})

// User verification flag
const isVerified = ref(false)

onMounted(async () => {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) return
    const { data } = await supabase.from('users').select('is_verified').eq('user_id', uid).single()
    isVerified.value = !!data?.is_verified
  } catch (e) {
    console.warn('Failed to fetch is_verified')
  }
})

// Logout handler
const logout = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Logout failed:', error.message)
    return
  }
  user.reset()
  window.location.href = '/'
}

// KYC state
type KycScores = {
  face_match?: number
  ocr_confidence?: number
  sanctions_match?: number
  overall?: number
  liveness?: number
}
type KycResult = {
  extracted?: Record<string, unknown>
  scores?: KycScores
  sanctions_matches?: Array<Record<string, unknown>>
  passed: boolean
  reason: string
}

const kycOpen = ref(false)
const kycLoading = ref(false)
const kycError = ref<string | null>(null)
const kycResult = ref<KycResult | null>(null)
const kycFront = ref<File | null>(null)
const kycBack = ref<File | null>(null)
const kycSelfie = ref<File | null>(null)
const kycFullName = ref('')
const kycDob = ref('')

async function submitKyc() {
  kycError.value = null
  kycResult.value = null
  if (!kycFront.value || !kycSelfie.value) {
    kycError.value = 'ID Front and Selfie are required.'
    return
  }
  kycLoading.value = true
  try {
    const fd = new FormData()
    fd.append('id_front', kycFront.value)
    fd.append('selfie', kycSelfie.value)
    if (kycBack.value) fd.append('id_back', kycBack.value)
    if (kycFullName.value) fd.append('full_name', kycFullName.value)
    if (kycDob.value) fd.append('dob', kycDob.value)

    console.log('[KYC] Submitting form-data summary:', {
      id_front: kycFront.value.name,
      selfie: kycSelfie.value.name,
      id_back: kycBack.value?.name,
      full_name: kycFullName.value,
      dob: kycDob.value,
    })
    const res = await fetch('http://localhost:5000/kyc/verify', { method: 'POST', body: fd })
    const data = (await res.json()) as KycResult | { error?: string }
    console.log('[KYC] Response:', data)
    if (!res.ok || (data as { error?: string }).error) {
      kycError.value = (data as { error?: string }).error || res.statusText
      return
    }
    kycResult.value = data as KycResult
    if (kycResult.value.passed) {
      // mark user as verified
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      if (uid) {
        const { error } = await supabase.from('users').update({ is_verified: true }).eq('user_id', uid)
        if (!error) {
          isVerified.value = true
          verifySnack.value.text = 'You are now a verified user.'
          verifySnack.value.color = 'success'
          verifySnack.value.show = true
        }
      }
    }
  } catch (e: unknown) {
    kycError.value = e instanceof Error ? e.message : String(e)
  } finally {
    kycLoading.value = false
  }
}

function resetKycForm() {
  kycFront.value = null
  kycBack.value = null
  kycSelfie.value = null
  kycFullName.value = ''
  kycDob.value = ''
  kycResult.value = null
  kycError.value = null
}

function onFrontChange(f: File | File[] | null | undefined) {
  kycFront.value = Array.isArray(f) ? f[0] || null : (f ?? (null as File | null))
}
function onSelfieChange(f: File | File[] | null | undefined) {
  kycSelfie.value = Array.isArray(f) ? f[0] || null : (f ?? (null as File | null))
}
function onBackChange(f: File | File[] | null | undefined) {
  kycBack.value = Array.isArray(f) ? f[0] || null : (f ?? (null as File | null))
}
function labelize(s: unknown) {
  return String(s).split('_').join(' ')
}
function matchName(m: Record<string, unknown>) {
  const n = m && typeof m.name === 'string' ? m.name : ''
  return n && n.trim() ? n : 'Match'
}

// Verification snackbar
const verifySnack = ref<{ show: boolean; text: string; color: string }>({
  show: false,
  text: '',
  color: 'success',
})
</script>

<template>
  <v-layout style="height: 100vh">
    <!-- Drawer -->
    <v-navigation-drawer
      v-model="drawer"
      app
      expand-on-hover
      class="drawer-root d-flex flex-column"
    >
      <v-list>
        <v-list-item
          :prepend-avatar="selectedImage"
          :subtitle="user.userEmail"
          :title="user.userFullName"
          @click="showAvatarDialog = true"
        />
      </v-list>

      <v-divider class="my-2" />

      <v-list density="compact" nav>
        <v-list-item
          to="/admin"
          value="/admin"
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          color="primary"
        />
        <v-list-item
          :prepend-icon="isVerified ? 'mdi-check-decagram' : 'mdi-account-check'"
          :title="isVerified ? `You're a verified user` : 'Verify Identity (KYC)'"
          :color="isVerified ? 'success' : 'primary'"
          :disabled="isVerified"
          @click="() => { if (!isVerified) kycOpen = true }"
        />
        <v-list-item
          v-if="isSuperAdmin"
          to="/super"
          value="/super"
          prepend-icon="mdi-shield-crown"
          title="Navigate to Super Admin"
          color="primary"
        />
        <v-list-item
          to="/AdminPrograms"
          value="/AdminPrograms"
          prepend-icon="mdi-account-multiple"
          title="Edit programs"
          color="primary"
        />
        <v-list-item
          to="/dashboard"
          value="/dashboard"
          prepend-icon="mdi-account-circle"
          title="Client Dashboard"
          color="primary"
        />
      </v-list>

      <!-- Fixed Logout Button -->
      <v-btn
        block
        color="error"
        class="logout-btn fixed-logout"
        prepend-icon="mdi-logout"
        @click="logout"
      >
        Logout
      </v-btn>
    </v-navigation-drawer>

    <v-app-bar app flat>
      <v-app-bar-nav-icon v-if="mdAndDown" @click="drawer = !drawer" />
      <v-toolbar-title class="text-h6">Admin</v-toolbar-title>
      <v-spacer />
      <v-btn
        :prepend-icon="
          theme.global.name.value === 'light' ? 'mdi-weather-sunny' : 'mdi-weather-night'
        "
        variant="text"
        @click="onClick"
      />
    </v-app-bar>

    <!-- Scrollable main content -->
    <v-main class="overflow-y-auto">
      <v-container fluid class="py-4">
        <slot />
      </v-container>
    </v-main>
  </v-layout>

  <!-- Avatar Dialog -->
  <v-dialog v-model="showAvatarDialog" max-width="400">
    <v-card>
      <v-card-title class="text-h6">Update Profile Photo</v-card-title>
      <v-card-text class="d-flex flex-column align-center">
        <v-img :src="selectedImage" width="150" height="150" class="mb-4 rounded-circle" cover />
        <v-btn color="primary" @click="fileInputRef?.click()">Change Photo</v-btn>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="d-none"
          @change="handleFileUpload"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="showAvatarDialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- KYC Dialog -->
  <v-dialog v-model="kycOpen" max-width="640">
    <v-card>
      <v-card-title class="text-h6">Verify Identity (KYC)</v-card-title>
      <v-card-text>
        <div class="text-caption text-medium-emphasis mb-3">
          Upload an ID and a selfie. Optional: back side, full name, and date of birth.
        </div>
        <v-alert v-if="kycError" type="error" variant="tonal" class="mb-3">{{ kycError }}</v-alert>

        <v-file-input
          label="ID Front (required)"
          accept="image/*"
          prepend-icon="mdi-card-account-details"
          :disabled="kycLoading"
          @update:modelValue="onFrontChange"
        />
        <v-file-input
          label="Selfie (required)"
          accept="image/*"
          prepend-icon="mdi-account"
          :disabled="kycLoading"
          @update:modelValue="onSelfieChange"
        />
        <v-file-input
          label="ID Back (optional)"
          accept="image/*"
          prepend-icon="mdi-card-account-details-outline"
          :disabled="kycLoading"
          @update:modelValue="onBackChange"
        />
        <v-text-field label="Full Name (optional)" v-model="kycFullName" :disabled="kycLoading" />
        <v-text-field
          label="Date of Birth (optional)"
          type="date"
          v-model="kycDob"
          :disabled="kycLoading"
        />

        <v-divider class="my-4" />
        <template v-if="kycResult">
          <div class="mb-2 d-flex align-center ga-2">
            <strong>Status:</strong>
            <v-chip :color="kycResult.passed ? 'success' : 'error'" variant="tonal" size="small">
              {{ kycResult.passed ? 'Passed' : 'Failed' }}
            </v-chip>
            <span class="text-medium-emphasis">Reason: {{ kycResult.reason }}</span>
          </div>
          <div class="text-subtitle-2 mb-1">Scores</div>
          <v-list density="compact" class="py-0">
            <v-list-item
              v-for="(val, key) in kycResult.scores || {}"
              :key="String(key)"
              class="px-0"
            >
              <v-list-item-title class="text-body-2">{{ labelize(key) }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">{{
                typeof val === 'number' ? (val * 100).toFixed(1) + '%' : String(val)
              }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
          <v-divider class="my-3" />
          <div class="text-subtitle-2 mb-1">Extracted</div>
          <v-list density="compact" class="py-0">
            <v-list-item
              v-for="(val, key) in kycResult.extracted || {}"
              :key="String(key)"
              class="px-0"
            >
              <v-list-item-title class="text-body-2">{{ labelize(key) }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">{{ String(val) }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
          <template v-if="(kycResult.sanctions_matches || []).length">
            <v-divider class="my-3" />
            <div class="text-subtitle-2 mb-1">Sanctions Matches</div>
            <v-list density="compact" class="py-0">
              <v-list-item v-for="(m, idx) in kycResult.sanctions_matches" :key="idx" class="px-0">
                <v-list-item-title class="text-body-2">{{ matchName(m) }}</v-list-item-title>
                <v-list-item-subtitle class="text-caption">{{
                  JSON.stringify(m)
                }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </template>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="kycLoading"
          @click="
            () => {
              resetKycForm()
              kycOpen = false
            }
          "
          >Close</v-btn
        >
        <v-btn color="primary" :loading="kycLoading" @click="submitKyc">Verify</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-snackbar v-model="verifySnack.show" :color="verifySnack.color" timeout="2500">
    {{ verifySnack.text }}
  </v-snackbar>
</template>

<style scoped>
.drawer-root {
  position: relative;
}
.logout-btn {
  font-weight: bold;
  color: white;
  border-radius: 8px;
  text-transform: uppercase;
}
.fixed-logout {
  position: absolute;

  right: 12px;
  bottom: 12px;
  z-index: 2;
}
</style>
