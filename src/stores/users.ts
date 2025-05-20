import { ref } from 'vue'
import { defineStore } from 'pinia'
import supabase from '@/lib/Supabase'

export const userCounterStore = defineStore('users', () => {
  const user = ref([])

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select()

    if (error) {
      console.error('Error fetching users:', error)
    } else {
      user.value = data
      console.log('Fetched users:', data)
    }
  }

  return { user, fetchUsers }
})
