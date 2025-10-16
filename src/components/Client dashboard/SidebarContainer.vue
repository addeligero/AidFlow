<script setup lang="ts">
import { useUserStore } from '@/stores/users'
import { providersStore } from '@/stores/providers'
import supabase from '@/lib/Supabase'
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

const channel = ref<any | null>(null)

onMounted(async () => {
  if (!userStore.isUserLoaded) await userStore.fetchUser()
  if (ps.providers.length === 0) await ps.fetchProviders()

  const myProvider = ps.providers.find((p) => p.id === userStore.user_id)
  status.value = myProvider ? (myProvider.status as any) : 'not a provider'

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
        status.value = updatedStatus as any
        console.log('Provider status updated:', updatedStatus)
      },
    )
    .subscribe()
})

onBeforeUnmount(() => {
  if (channel.value) {
    supabase.removeChannel(channel.value)
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

    const updates: any = { data: { full_name: `${editFirstName.value} ${editLastName.value}` } }
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
  } catch (e: any) {
    console.error('Failed to save details:', e?.message || e)
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
