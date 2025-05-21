import { ref } from 'vue'
import { defineStore } from 'pinia'
import supabase from '@/lib/Supabase'

export const userCounterStore = defineStore('users', () => {
  const userFullName = ref('')
  const user = ref([])

  const fetchUsers = async () => {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      console.error('Not authenticated:', authError)
      return
    }

    userFullName.value = authUser.user_metadata.full_name
    console.log('User full name:', userFullName.value)
  }

  return { user, fetchUsers }
})
