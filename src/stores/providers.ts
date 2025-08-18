import { ref } from 'vue'
import { defineStore } from 'pinia'
import supabase from '@/lib/Supabase'
import defaultlogo from '@/assets/img/logo/defaultlogo.jp.jpg' // check extension

export const providersStore = defineStore('providers', () => {
  const providers = ref<{ agencyName: string; logo: string }[]>([])
  const loading = ref(false)

  const fetchProviders = async () => {
    if (loading.value) return
    loading.value = true
    const { data, error } = await supabase.from('providers').select('agency_name, logo')
    if (error) {
      console.error('Error fetching providers:', error)
    } else {
      providers.value = (data || []).map((p) => ({
        agencyName: p.agency_name,
        logo: p.logo || defaultlogo,
      }))
    }
    loading.value = false
  }

  return { providers, loading, fetchProviders }
})
