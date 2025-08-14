<script setup lang="ts">
import { useUserStore } from '@/stores/users'
import supabase from '@/lib/Supabase'
import { ref } from 'vue'

const userStore = useUserStore()

const props = defineProps({
  modelValue: Boolean,
})
const emit = defineEmits(['update:modelValue'])

const showAvatarDialog = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const logout = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Logout failed:', error.message)
  } else {
    window.location.href = '/'
  }
}

const navigate = (route: string) => {
  emit('update:modelValue', false)
  window.location.href = `/${route}`
}

// Upload and update store
const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    console.error('No authenticated user found')
    return
  }

  isUploading.value = true // Start loading state

  const fileExt = file.name.split('.').pop()
  const fileName = `${authUser.id}-${Date.now()}.${fileExt}`
  const filePath = `client-profile/${fileName}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    console.error('Upload failed:', uploadError.message)
    isUploading.value = false
    return
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
  const publicUrl = publicUrlData.publicUrl

  // Save URL in users table
  const { error: updateError } = await supabase
    .from('users')
    .update({ img: publicUrl })
    .eq('user_id', authUser.id)

  if (updateError) {
    console.error('Failed to update user image:', updateError.message)
    isUploading.value = false
    return
  }

  // Update Pinia store immediately
  userStore.userProfileImg = publicUrl

  // End loading state
  isUploading.value = false
}
</script>

<template>
  <!-- Dialog for Avatar -->
  <v-dialog v-model="showAvatarDialog" max-width="400">
    <v-card>
      <v-card-title class="text-h6">Update Profile Photo</v-card-title>
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
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="showAvatarDialog = false">Close</v-btn>
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
        prepend-avatar="https://randomuser.me/api/portraits/men/78.jpg"
        title="Loading..."
        @click="showAvatarDialog = true"
      />

      <v-divider />

      <!-- Navigation -->
      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Home"
          @click="() => navigate('dashboard')"
        />
        <v-list-item prepend-icon="mdi-forum" title="About" />
        <v-list-item
          prepend-icon="mdi-forum"
          title="Be a provider"
          @click="() => navigate('application')"
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
