<script setup lang="ts">
import { useTheme, useDisplay } from 'vuetify'
import { ref, computed, onMounted } from 'vue'
import { providersStore } from '@/stores/providers'
import { useUserStore } from '@/stores/users'
import supabase from '@/lib/Supabase'

const ps = providersStore()
const user = useUserStore()
const props = defineProps<{ userAvatar?: string }>()
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

  const { data: userData, error } = await supabase.auth.getUser()
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
          v-if="isSuperAdmin"
          to="/super"
          value="/super"
          prepend-icon="mdi-shield-crown"
          title="Navigate to Super Admin"
          color="primary"
        />
        <v-list-item
          to="/my-rules"
          value="/myrules"
          prepend-icon="mdi-account-multiple"
          title="Add rules"
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
