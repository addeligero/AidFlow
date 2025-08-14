import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import supabase from '@/lib/Supabase'
import type { User } from '@supabase/supabase-js'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null) // Supabase auth user
  const isUserLoaded = ref(false) // Marks if user info is loaded
  const isImageUploading = ref(false) // True while new profile image is uploading
  const userProfileImg = ref<string>('') // Final profile image URL

  // Fetch the authenticated user and profile image
  const fetchUser = async () => {
    if (this.isUserLoaded) return

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      console.error('Not authenticated:', authError)
      isUserLoaded.value = true
      return
    }

    user.value = authUser

    const { data, error } = await supabase
      .from('users')
      .select('img')
      .eq('user_id', authUser.id)
      .single()

    if (!error && data?.img) {
      userProfileImg.value = data.img
    } else {
      // Fallback avatar from metadata
      const metadata = authUser.user_metadata || {}
      const gender = metadata.gender === 'female' ? 'women' : 'men'
      const id = metadata.avatar_id || '1'
      userProfileImg.value = `https://randomuser.me/api/portraits/${gender}/${id}.jpg`
    }

    isUserLoaded.value = true
  }

  // Call this when starting an image upload
  const startImageUpload = () => {
    isImageUploading.value = true
  }

  // Call this when upload finishes successfully
  const finishImageUpload = (newImageUrl: string) => {
    userProfileImg.value = newImageUrl
    isImageUploading.value = false
  }

  const userFullName = computed(() => {
    return user.value?.user_metadata?.full_name || 'User'
  })

  const userEmail = computed(() => {
    return user.value?.email || 'No email'
  })

  return {
    user,
    isUserLoaded,
    isImageUploading,
    userProfileImg,
    fetchUser,
    startImageUpload,
    finishImageUpload,
    userFullName,
    userEmail,
  }
})
