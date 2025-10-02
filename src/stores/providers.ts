import { ref } from 'vue'
import { defineStore } from 'pinia'
import supabase from '@/lib/Supabase'
import defaultlogo from '@/assets/img/logo/defaultlogo.jp.jpg'

type Provider = {
  id: string
  agency_name: string
  logo?: string
  status: string
  rejection_reason?: string
  created_at?: string
  is_super_admin?: boolean
  contact_person?: string
  agency_email?: string
  agency_num?: string
  office_address?: string
}

type RuleRequirement = {
  id: string
  name: string
  field_key: string
  operator: string
  value: string
  description?: string | null
}

type Rule = {
  id: string
  rule_name: string
  description?: string | null
  classification?: string | null
  subsidy_amount?: number
  provider_id: string
  created_at?: string
  conditions: Record<string, string>
  requirements: RuleRequirement[]
  provider: {
    agency_name: string
    logo?: string
    status?: string
  }
}

export const providersStore = defineStore('providers', () => {
  const providers = ref<Provider[]>([])
  const providersLoading = ref(false)

  const fetchProviders = async () => {
    if (providersLoading.value) return
    providersLoading.value = true
    try {
      const { data, error } = await supabase
        .from('providers')
        .select(
          'id, agency_name, logo, status, rejection_reason, created_at, is_super_admin, contact_person,agency_email, agency_num, office_address',
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      providers.value = (data || []) as Provider[]
    } catch (e) {
      console.error('Failed to fetch providers:', (e as any)?.message || e)
      providers.value = []
    } finally {
      providersLoading.value = false
    }
  }

  // --- Rules ---
  const rules = ref<Rule[]>([])
  const rulesLoading = ref(false)

  const operatorLabels: Record<string, string> = {
    equals: 'equals',
    not_equals: 'not equals',
    greater_than: 'greater than',
    greater_or_equal: 'greater or equal',
    less_than: 'less than',
    less_or_equal: 'less or equal',
    contains: 'contains',
  }

  const summarizeRequirement = (requirement: RuleRequirement, index: number) => {
    if (requirement.description && requirement.description.trim()) {
      return requirement.description.trim()
    }
    const operatorLabel =
      operatorLabels[requirement.operator] || requirement.operator.replace(/_/g, ' ')
    return `${requirement.field_key} ${operatorLabel} ${requirement.value}`.trim()
  }

  const fetchRules = async () => {
    if (rulesLoading.value) return
    rulesLoading.value = true
    console.log('Fetching rules...')
    try {
      const { data, error } = await supabase
        .from('subsidy_rules')
        .select(
          `id, rule_name, description, classification, subsidy_amount, provider_id, created_at,
           rule_requirements:subsidy_rule_requirements (
             requirement:subsidy_requirements (id, name, field_key, operator, value, description)
           )`,
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      const providerMap = providers.value.reduce<Record<string, Provider>>((acc, provider) => {
        acc[provider.id] = provider
        return acc
      }, {})

      rules.value = (data || []).map((row: any) => {
        const requirementRows = ((row.rule_requirements as any[]) || [])
          .map((link) => link?.requirement)
          .filter(Boolean) as RuleRequirement[]

        const conditions = requirementRows.reduce<Record<string, string>>(
          (acc, requirement, index) => {
            const label = requirement.name?.trim() || `Requirement ${index + 1}`
            acc[label] = summarizeRequirement(requirement, index)
            return acc
          },
          {},
        )

        const providerEntry = providerMap[row.provider_id] || null

        return {
          id: row.id,
          rule_name: row.rule_name,
          description: row.description,
          classification: row.classification,
          subsidy_amount:
            row.subsidy_amount !== null && row.subsidy_amount !== undefined
              ? Number(row.subsidy_amount)
              : undefined,
          provider_id: row.provider_id,
          created_at: row.created_at,
          conditions,
          requirements: requirementRows,
          provider: {
            agency_name: providerEntry?.agency_name || 'Unknown Provider',
            logo: providerEntry?.logo || defaultlogo,
            status: providerEntry?.status,
          },
        }
      })
    } catch (error) {
      console.error('Error fetching rules:', (error as any)?.message || error)
      rules.value = []
    } finally {
      rulesLoading.value = false
    }
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
