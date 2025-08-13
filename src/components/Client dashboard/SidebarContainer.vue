<script setup lang="ts">
import { userCounterStore } from '@/stores/users'
import supabase from '@/lib/Supabase'
import { ref, onMounted } from 'vue'

const userStore = userCounterStore()
const showAvatarDialog = ref(false)
const selectedImage = ref('https://randomuser.me/api/portraits/men/78.jpg')
const fileInput = ref<HTMLInputElement | null>(null)
const triggerFileInput = () => {
  ;(fileInput.value as HTMLInputElement)?.click()
}

//chech the image idol
onMounted(async () => {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return

  const { data, error } = await supabase.from('users').select('img').eq('user_id', userId).single()

  if (error) {
    console.error('Error fetching user image:', error.message)
    return
  }

  if (data?.img) {
    selectedImage.value = data.img
  }
})

const props = defineProps({
  modelValue: Boolean,
})
const emit = defineEmits(['update:modelValue'])

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

// Handle file upload
const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Get user ID first
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) {
    console.error('No authenticated user found')
    return
  }

  // Generate a safe file path (store in user folder)
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `client-profile/${fileName}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    console.error('Upload failed:', uploadError.message)
    return
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)

  const publicUrl = publicUrlData.publicUrl

  // Save URL to the users table
  const { error: updateError } = await supabase
    .from('users')
    .update({ img: publicUrl })
    .eq('user_id', userId)

  if (updateError) {
    console.error('Failed to update user image:', updateError.message)
    return
  }

  // Update UI
  selectedImage.value = publicUrl
}
</script>
<template>
  <!-- Dialog -->
  <v-dialog v-model="showAvatarDialog" max-width="400">
    <v-card>
      <v-card-title class="text-h6">Update Profile Photo</v-card-title>

      <v-card-text class="d-flex flex-column align-center">
        <v-avatar size="150" class="mb-4">
          <v-img :src="selectedImage" cover />
        </v-avatar>

        <v-btn color="primary" @click="triggerFileInput"> Choose New Photo </v-btn>

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

  <v-navigation-drawer
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    temporary
    class="drawer-root d-flex flex-column"
  >
    <div class="drawer-content">
      <v-list-item
        v-if="userStore.isUserLoaded"
        :prepend-avatar="
          selectedImage || userStore.userImg || 'https://randomuser.me/api/portraits/men/78.jpg'
        "
        :subtitle="userStore.userEmail"
        :title="userStore.userFullName"
        @click="showAvatarDialog = true"
      />

      <v-list-item
        v-else
        prepend-avatar="https://randomuser.me/api/portraits/men/78.jpg"
        title="Loading..."
        @click="showAvatarDialog = true"
      />

      <v-divider></v-divider>

      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Home"
          value="home"
          @click="() => navigate('dashboard')"
        />
        <v-list-item prepend-icon="mdi-forum" title="About" value="about" />
      </v-list>
    </div>

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
