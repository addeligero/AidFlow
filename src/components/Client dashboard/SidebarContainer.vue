<script setup lang="ts">
import { useUserStore } from '../../stores/users'
import { providersStore } from '../../stores/providers'
import supabase from '../../lib/Supabase'
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const noimage = '@/assets/noimage.png'
const ps = providersStore()
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const status = ref<'approved' | 'pending' | 'rejected' | 'not a provider'>('not a provider')
const showPendingDialog = ref(false)
const showRejectedDialog = ref(false)

import type { RealtimeChannel } from '@supabase/supabase-js'
const channel = ref<RealtimeChannel | null>(null)

onMounted(async () => {
  if (!userStore.isUserLoaded) await userStore.fetchUser()
  if (ps.providers.length === 0) await ps.fetchProviders()

  const myProvider = ps.providers.find((p) => p.id === userStore.user_id)
  status.value = myProvider
    ? (myProvider.status as 'approved' | 'pending' | 'rejected')
    : 'not a provider'

  channel.value = supabase
    .channel('provider-status')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'providers',
        filter: `id=eq.${userStore.user_id}`,
      },
      (payload) => {
        const updatedStatus = payload.new.status
        status.value = updatedStatus as 'approved' | 'pending' | 'rejected'
        console.log('Provider status updated:', updatedStatus)
      },
    )
    .subscribe()

  // Fetch initial verification status
  if (userStore.user_id) {
    supabase
      .from('users')
      .select('is_verified')
      .eq('user_id', userStore.user_id)
      .single()
      .then(
        ({ data, error }) => {
          if (!error && data) {
            isVerified.value = !!(data as { is_verified?: boolean }).is_verified
          }
        },
        () => {
          console.warn('Failed to fetch verification status')
        },
      )
  }
})

onBeforeUnmount(() => {
  if (channel.value) {
    channel.value.unsubscribe()
  }
})

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])

const showAvatarDialog = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const isSavingDetails = ref(false)
const editFirstName = ref('')
const editLastName = ref('')
const editEmail = ref('')

const triggerFileInput = () => fileInput.value?.click()

// Prefill editable fields when dialog opens
watch(showAvatarDialog, async (open) => {
  if (!open) return
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return
  const { data, error } = await supabase
    .from('users')
    .select('first_name,last_name,email')
    .eq('user_id', authUser.id)
    .single()
  if (!error && data) {
    editFirstName.value = data.first_name || ''
    editLastName.value = data.last_name || ''
    editEmail.value = data.email || authUser.email || ''
  } else {
    editFirstName.value = authUser.user_metadata?.full_name?.split(' ')?.[0] || ''
    editLastName.value = authUser.user_metadata?.full_name?.split(' ')?.slice(1).join(' ') || ''
    editEmail.value = authUser.email || ''
  }
})

const saveProfileDetails = async () => {
  isSavingDetails.value = true
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser) throw new Error('Not authenticated')

    const updates: { data: { full_name: string }; email?: string } = {
      data: { full_name: `${editFirstName.value} ${editLastName.value}` },
    }
    if (editEmail.value && editEmail.value !== authUser.email) {
      updates.email = editEmail.value
    }
    const { error: authErr } = await supabase.auth.updateUser(updates)
    if (authErr) console.warn('Auth update warning:', authErr.message)

    const { error: dbErr } = await supabase
      .from('users')
      .update({
        first_name: editFirstName.value,
        last_name: editLastName.value,
        email: editEmail.value,
      })
      .eq('user_id', authUser.id)
    if (dbErr) throw dbErr

    // Refresh local store info
    await userStore.fetchUser()
    showAvatarDialog.value = false
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Failed to save details:', msg)
  } finally {
    isSavingDetails.value = false
  }
}

const logout = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) console.error('Logout failed:', error.message)
  else {
    userStore.reset()
    window.location.href = '/'
  }
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return console.error('No authenticated user found')

  isUploading.value = true
  const fileExt = file.name.split('.').pop()
  const fileName = `${authUser.id}-${Date.now()}.${fileExt}`
  const filePath = `client-profile/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    console.error('Upload failed:', uploadError.message)
    isUploading.value = false
    return
  }

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
  const publicUrl = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from('users')
    .update({ img: publicUrl })
    .eq('user_id', authUser.id)

  if (updateError) {
    console.error('Failed to update user image:', updateError.message)
    isUploading.value = false
    return
  }

  userStore.userProfileImg = publicUrl
  await userStore.fetchUser()
  isUploading.value = false
}

const providerActionLabel = computed(() => {
  if (status.value === 'approved') return 'Provider Dashboard'
  if (status.value === 'pending') return 'Pending Approval'
  if (status.value === 'rejected') return 'Application Rejected'
  return 'Be a Provider'
})

const handleProviderAction = () => {
  if (status.value === 'approved') {
    router.push('/admin')
  } else if (status.value === 'pending') {
    showPendingDialog.value = true
  } else if (status.value === 'rejected') {
    showRejectedDialog.value = true
  } else {
    router.push('/application')
  }
}

// KYC state (client)
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

// Verified status and snackbar
const isVerified = ref(false)
const verifySnack = ref(false)

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

    // If verification passed, persist to DB and show snackbar
    if ((kycResult.value as KycResult).passed) {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (authUser) {
        const { error: upErr } = await supabase
          .from('users')
          .update({ is_verified: true })
          .eq('user_id', authUser.id)
        if (!upErr) {
          isVerified.value = true
          verifySnack.value = true
        } else {
          console.warn('Failed to update verification status:', upErr.message)
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
</script>

<template>
  <!-- Dialog for Avatar -->
  <v-dialog v-model="showAvatarDialog" max-width="400">
    <v-card>
      <v-card-title class="text-h6">Update Profile</v-card-title>
      <v-card-text class="d-flex flex-column align-center">
        <v-avatar size="150" class="mb-4">
          <template v-if="isUploading">
            <v-progress-circular indeterminate color="primary" size="48" />
          </template>
          <template v-else>
            <v-img :src="userStore.userProfileImg" cover />
          </template>
        </v-avatar>
        <v-btn color="primary" @click="triggerFileInput">Choose New Photo</v-btn>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="d-none"
          @change="handleFileUpload"
        />

        <v-divider class="my-4" />
        <v-text-field
          v-model="editFirstName"
          label="First name"
          density="comfortable"
          class="w-100"
        />
        <v-text-field
          v-model="editLastName"
          label="Last name"
          density="comfortable"
          class="w-100"
        />
        <v-text-field
          v-model="editEmail"
          label="Email"
          type="email"
          density="comfortable"
          class="w-100"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="showAvatarDialog = false">Close</v-btn>
        <v-btn color="primary" :loading="isSavingDetails" @click="saveProfileDetails">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Sidebar -->
  <v-navigation-drawer
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    temporary
    class="drawer-root d-flex flex-column"
  >
    <div class="drawer-content">
      <!-- User Info -->
      <v-list-item
        v-if="userStore.isUserLoaded"
        :prepend-avatar="isUploading ? '' : userStore.userProfileImg"
        :subtitle="userStore.userEmail"
        :title="userStore.userFullName"
        @click="showAvatarDialog = true"
      >
        <template v-if="isUploading" #prepend>
          <v-progress-circular indeterminate color="primary" size="24" />
        </template>
      </v-list-item>

      <v-list-item
        v-else
        :prepend-avatar="noimage"
        title="Loading..."
        @click="showAvatarDialog = true"
      />

      <v-divider />

      <!-- Navigation -->
      <v-list density="compact" nav>
        <!-- Home -->
        <RouterLink to="/dashboard" custom v-slot="{ navigate }">
          <v-list-item
            prepend-icon="mdi-view-dashboard"
            title="Home"
            :active="route.path === '/dashboard'"
            @click="
              () => {
                emit('update:modelValue', false)
                navigate()
              }
            "
          />
        </RouterLink>

        <!-- View Rules -->
        <RouterLink to="/programs" custom v-slot="{ navigate }">
          <v-list-item
            prepend-icon="mdi-forum"
            title="View Programs"
            :active="route.path === '/programs'"
            @click="
              () => {
                emit('update:modelValue', false)
                navigate()
              }
            "
          />
        </RouterLink>

        <!-- Provider/Admin action -->
        <v-list-item
          prepend-icon="mdi-account-badge"
          :title="providerActionLabel"
          @click="
            () => {
              emit('update:modelValue', false)
              handleProviderAction()
            }
          "
        />

        <!-- KYC (Client) -->
        <v-list-item
          :prepend-icon="isVerified ? 'mdi-shield-check' : 'mdi-account-check'"
          :title="isVerified ? `You're a verified user` : 'Verify Identity (KYC)'"
          :disabled="isVerified"
          :color="isVerified ? 'success' : undefined"
          @click="
            () => {
              emit('update:modelValue', false)
              kycOpen = true
            }
          "
        />
      </v-list>
    </div>

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

  <!-- Verification success snackbar --> 
  <v-snackbar v-model="verifySnack" color="success" :timeout="3000">
    You're a verified user now.
    <template #actions>
      <v-btn variant="text" @click="verifySnack = false">Close</v-btn>
    </template>
  </v-snackbar>

  <!-- Pending Status Dialog -->
  <v-dialog v-model="showPendingDialog" max-width="420">
    <v-card>
      <v-card-title class="text-h6">Application Pending</v-card-title>
      <v-card-text>
        Your provider application is currently under review. You'll be notified once it's approved.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <RouterLink to="/dashboard">
          <v-btn variant="text" @click="showPendingDialog = false">Close</v-btn>
        </RouterLink>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Rejected Status Dialog -->
  <v-dialog v-model="showRejectedDialog" max-width="420">
    <v-card>
      <v-card-title class="text-h6">Application Rejected</v-card-title>
      <v-card-text>
        Unfortunately, your provider application was not approved. You may update your information
        and apply again.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="showRejectedDialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.drawer-root {
  position: relative;
  height: 100vh;
}
.drawer-content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  padding-bottom: 70px;
}
.logout-btn {
  font-weight: bold;
  color: white;
  border-radius: 8px;
  text-transform: uppercase;
}
.fixed-logout {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0 0 12px 0;
  width: calc(100% - 0px);
  z-index: 2;
}
</style>
