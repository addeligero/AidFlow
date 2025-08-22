import { ref } from 'vue'
import { defineStore } from 'pinia'
import supabase from '@/lib/Supabase'
import defaultlogo from '@/assets/img/logo/defaultlogo.jp.jpg' // ✅ check extension

type Provider = {
  id: string
  agency_name: string
  logo?: string
  status: string
}

type Rule = {
  id: string
  rule_name: string
  conditions: Record<string, any>
  subsidy_amount?: number
  provider: {
    agency_name: string
    logo?: string
  }
}

export const providersStore = defineStore('providers', () => {
  const providers = ref<Provider[]>([])
  const providersLoading = ref(false)
  const fetchProviders = async () => {
    if (providersLoading.value) return
    providersLoading.value = true
    console.log('Fetching providers...')

    const { data, error } = await supabase.from('providers').select('id, agency_name, logo, status')

    if (error) {
      console.error('Error fetching providers:', error)
    } else {
      providers.value =
        data?.map((p: any) => ({
          id: p.id,
          agency_name: p.agency_name,
          logo: p.logo || defaultlogo,
          status: p.status,
        })) || []

      providers.value.forEach((p) => console.log('status', p.status))
    }

    providersLoading.value = false
  }

  // --- Rules ---
  const rules = ref<Rule[]>([])
  const rulesLoading = ref(false)

  const fetchRules = async () => {
    if (rulesLoading.value) return
    rulesLoading.value = true
    console.log('Fetching rules...')

    const { data, error } = await supabase.from('subsidy_rules').select(`
  id,
  rule_name,
  conditions,
  subsidy_amount,
  provider:providers (
    agency_name,
    logo,
    status
  )
`)

    console.log('Fetched rules:', data)

    if (error) {
      console.error('Error fetching rules:', error)
    } else {
      console.log('Fetched rules:', data)
      rules.value = (data || []).map((r: any) => ({
        id: r.id,
        rule_name: r.rule_name,
        conditions: r.conditions,
        subsidy_amount: r.subsidy_amount,
        provider: {
          agency_name: r.provider?.agency_name || 'Unknown',
          logo: r.provider?.logo || defaultlogo,
          status: r.provider?.status,
        },
      })) as Rule[]
    }

    rulesLoading.value = false
  }

  return {
    providers,
    providersLoading,
    fetchProviders,
    rules,
    rulesLoading,
    fetchRules,
  }
})
