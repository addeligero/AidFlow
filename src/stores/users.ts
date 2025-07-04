import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import supabase from '@/lib/Supabase'
import type { User } from '@supabase/supabase-js'

export const userCounterStore = defineStore('users', () => {
  const user = ref<User[]>([])
  const isUserLoaded = ref(false)

  const fetchUsers = async () => {
    console.log('[fetchUsers] called')

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      console.error('Not authenticated:', authError)
      isUserLoaded.value = true
      return
    }

    console.log('[fetchUsers] metadata:', authUser.user_metadata)

    user.value = [authUser]
    isUserLoaded.value = true
  }

  const userFullName = computed(() => {
    const metadata = user.value[0]?.user_metadata || {}
    return metadata.full_name || 'User'
  })
  const userEmail = computed(() => {
    return user.value[0]?.email || 'No email'
  })

  return {
    user,
    fetchUsers,
    userFullName,
    isUserLoaded,
    userEmail,
  }
})
