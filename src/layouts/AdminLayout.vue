<script setup lang="ts">
import { useTheme, useDisplay } from 'vuetify'
import { ref } from 'vue'

import { useUserStore } from '@/stores/users'
import supabase from '@/lib/Supabase'

const user = useUserStore()
const props = defineProps<{ userAvatar?: string }>()
const drawer = ref(true)
const { mdAndDown } = useDisplay()

// Theme toggle
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

  // Preview before uploading
  const reader = new FileReader()
  reader.onload = () => {
    selectedImage.value = reader.result as string
  }
  reader.readAsDataURL(file)

  // Get user ID
  const { data: userData, error: userError } = await supabase.auth.getUser()
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

  // Get public URL
  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
  const publicUrl = publicUrlData.publicUrl

  // Update users table
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
</script>

<template>
  <v-card style="height: 100vh">
    <v-layout style="height: 100%">
      <v-app-bar flat>
        <v-app-bar-nav-icon v-if="mdAndDown" @click="drawer = !drawer" />
        <v-toolbar-title><h4>Admin</h4></v-toolbar-title>

        <v-btn
          :prepend-icon="
            theme.global.name.value === 'light' ? 'mdi-weather-sunny' : 'mdi-weather-night'
          "
          slim
          @click="onClick"
        ></v-btn>
      </v-app-bar>

      <v-navigation-drawer v-model="drawer" expand-on-hover height="100%" app>
        <hr />
        <v-list>
          <v-list-item
            :prepend-avatar="selectedImage"
            :subtitle="user.userEmail"
            :title="user.userFullName"
            @click="showAvatarDialog = true"
            class="cursor-pointer"
          />
        </v-list>

        <v-divider></v-divider>

        <v-list density="compact" nav>
          <v-list-item prepend-icon="mdi-folder" title="My Files" value="myfiles"></v-list-item>
          <v-list-item
            prepend-icon="mdi-account-multiple"
            title="Shared with me"
            value="shared"
          ></v-list-item>
          <v-list-item prepend-icon="mdi-star" title="Starred" value="starred"></v-list-item>
        </v-list>
      </v-navigation-drawer>

      <v-main
        style="height: 100%"
        :class="theme.global.name.value === 'dark' ? 'bg-black' : 'bg-grey-lighten-1'"
      >
        <hr />
        <br />

        <v-container> <slot /></v-container>
      </v-main>
    </v-layout>
  </v-card>
  <!-- doalog for avatars -->
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
        <v-spacer></v-spacer>
        <v-btn text @click="showAvatarDialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
