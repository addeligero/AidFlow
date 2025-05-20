import { ref } from 'vue'
import { defineStore } from 'pinia'
import supabase from '@/lib/Supabase'

export const userCounterStore = defineStore('users', () => {
  const user = ref([])
  const authId = sessionStorage.getItem('auth_id')
  const fetchUsers = async () => {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      console.error('Not authenticated:', authError)
      return
    }

    const { data, error } = await supabase.from('users').select().eq('user_id', authUser.id)

    if (error) {
      console.error('Error fetching users:', error)
    } else {
      user.value = data
      console.log('Fetched users:', data)
    }
  }

  return { user, fetchUsers }
})
