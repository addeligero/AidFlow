// src/stores/providers.ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
import supabase from '@/lib/Supabase'
import defaultlogo from '@/assets/img/logo/defaultlogo.jp.jpg'

export const providersStore = defineStore('providers', () => {
  const providers = ref<{ agencyName: string; logo: string }[]>([])

  const fetchProviders = async () => {
    const { data, error } = await supabase.from('providers').select('agency_name, logo')
    console.log('check', data)

    if (error) {
      console.error('Error fetching providers:', error)
      return
    }

    providers.value = data.map((p) => ({
      agencyName: p.agency_name,
      logo: p.logo || defaultlogo,
    }))
  }

  return { providers, fetchProviders }
})
