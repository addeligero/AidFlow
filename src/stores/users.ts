import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import supabase from '@/lib/Supabase'
import type { User } from '@supabase/supabase-js'

export const useUserStore = defineStore(
  'user',
  () => {
    const user = ref<User | null>(null)
    const isUserLoaded = ref(false)
    const isImageUploading = ref(false)
    const userProfileImg = ref<string>('')
    const user_id = ref<string>('')
    const first_name = ref<string>('')
    // Cache flags for users table profile row
    const profileLoaded = ref(false)
    const lastProfileFetch = ref<number | null>(null)
    // TTL for profile re-fetch (ms). Adjust as needed.
    const PROFILE_TTL = 5 * 60 * 1000

    const fetchUser = async () => {
      // Always ensure auth user fetched once
      if (!isUserLoaded.value) {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser()
        if (authError || !authUser) {
          console.error('Not authenticated:', authError)
          isUserLoaded.value = false
          return
        }
        user.value = authUser
        isUserLoaded.value = true
      }

      // Decide if we need to hit users table (profile row)
      const now = Date.now()
      const stale = !lastProfileFetch.value || now - lastProfileFetch.value > PROFILE_TTL
      if (profileLoaded.value && !stale) return

      const authId = user.value?.id
      if (!authId) return
      const { data, error } = await supabase
        .from('users')
        .select('id,img,last_name')
        .eq('user_id', authId)
        .single()
      if (error) {
        // If failed but we don't have a profile yet, keep fallback avatar; don't throw
        console.warn('Profile fetch failed (users table):', error.message)
        return
      }
      profileLoaded.value = true
      lastProfileFetch.value = now
      if (data) {
        first_name.value = data.last_name
        user_id.value = data.id
        if (data.img) {
          userProfileImg.value = data.img
          return
        }
      }
      // Fallback avatar if no img
      const metadata = user.value?.user_metadata || {}
      const gender = metadata.gender === 'female' ? 'women' : 'men'
      const id = metadata.avatar_id || '1'
      userProfileImg.value = `https://randomuser.me/api/portraits/${gender}/${id}.jpg`
    }

    // Force refresh ignoring TTL
    const refreshProfile = async () => {
      profileLoaded.value = false
      lastProfileFetch.value = null
      await fetchUser()
    }

    const startImageUpload = () => {
      isImageUploading.value = true
    }

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

    const reset = () => {
      user.value = null
      isUserLoaded.value = false
      isImageUploading.value = false
      userProfileImg.value = ''
      profileLoaded.value = false
      lastProfileFetch.value = null
    }

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
      user_id,
      reset,
      first_name,
      profileLoaded,
      refreshProfile,
    }
  },
  {
    persist: true,
  },
)
