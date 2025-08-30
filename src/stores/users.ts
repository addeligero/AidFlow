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

    const fetchUser = async () => {
      if (isUserLoaded.value) return

      console.log('Fetching user data... bitchrssssssssssss')
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

      const { data, error } = await supabase
        .from('users')
        .select('id,img,last_name')
        .eq('user_id', authUser.id)
        .single()

      if (!error) {
        console.log('niagi here')

        first_name.value = data.last_name
        user_id.value = data.id
      }
      if (data?.img) {
        userProfileImg.value = data.img
      } else {
        // Fallback avatar from metadata
        console.log('niagi heresss')
        const metadata = authUser.user_metadata || {}
        const gender = metadata.gender === 'female' ? 'women' : 'men'
        const id = metadata.avatar_id || '1'
        userProfileImg.value = `https://randomuser.me/api/portraits/${gender}/${id}.jpg`
      }
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
    }
  },
  {
    persist: true,
  },
)
