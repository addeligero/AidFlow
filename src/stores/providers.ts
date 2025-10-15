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
  program?: string
  agency_email?: string
  agency_num?: string
  office_address?: string
}

type RequirementExtra = Record<string, unknown> | string | null

type RuleRequirement = {
  id: string
  name: string
  type: 'document' | 'condition'
  field_key?: string | null
  operator?: string | null
  value?: string | null
  description?: string | null
  extra?: RequirementExtra
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
  program?: string
  provider: {
    agency_name: string
    logo?: string
    status?: string
    program?: string
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
          'id, agency_name, logo, status, rejection_reason, created_at, is_super_admin, program,agency_email, agency_num, office_address',
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      providers.value = (data || []) as Provider[]
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('Failed to fetch providers:', message)
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

  const parseRequirementExtra = (raw: unknown): RequirementExtra => {
    if (!raw) return null
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return typeof parsed === 'object' && parsed !== null ? parsed : null
      } catch {
        return raw
      }
    }
    if (typeof raw === 'object') {
      return raw as Record<string, unknown>
    }
    return null
  }

  const extractRequirementNote = (extra?: RequirementExtra) => {
    if (!extra) return null
    if (typeof extra === 'string') return extra
    const candidate = extra.note || extra.instructions || extra.details || extra.detail
    if (candidate) return String(candidate)
    try {
      return JSON.stringify(extra)
    } catch {
      return null
    }
  }

  const summarizeRequirement = (requirement: RuleRequirement) => {
    if (requirement.type === 'document') {
      return (
        requirement.description?.trim() ||
        extractRequirementNote(requirement.extra) ||
        `Provide ${requirement.name}`
      )
    }

    const operatorLabel =
      operatorLabels[requirement.operator || ''] || requirement.operator?.replace(/_/g, ' ')
    const field = requirement.field_key || 'value'
    const value = requirement.value || ''
    return [field, operatorLabel, value].filter(Boolean).join(' ').trim()
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
             requirement:subsidy_requirements (
               id, name, type, field_key, operator, value, description, extra
             )
           )`,
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      const providerMap = providers.value.reduce<Record<string, Provider>>((acc, provider) => {
        const idKey = provider.id ? String(provider.id) : undefined
        const userKey = provider.id ? String(provider.id) : undefined
        if (idKey) acc[idKey] = provider
        if (userKey) acc[userKey] = provider
        return acc
      }, {})

      const rows = (data ?? []) as Array<Record<string, unknown>>

      rules.value = rows.map((row) => {
        const ruleRequirements =
          (row.rule_requirements as Array<Record<string, unknown>> | null | undefined) ?? []

        const requirementRows: RuleRequirement[] = ruleRequirements
          .map((link) => {
            const req = link?.requirement as Record<string, unknown> | undefined
            if (!req) return null
            const extra = parseRequirementExtra(req.extra as unknown)
            return {
              id: String(req.id as string | number),
              name: (req.name as string) ?? '',
              type: (req.type as string as 'document' | 'condition') ?? 'document',
              field_key: (req.field_key as string | null) ?? null,
              operator: (req.operator as string | null) ?? null,
              value: (req.value as string | null) ?? null,
              description: (req.description as string | null) ?? null,
              extra,
            } as RuleRequirement
          })
          .filter((x): x is RuleRequirement => x !== null)

        const conditions = requirementRows.reduce<Record<string, string>>(
          (acc, requirement: RuleRequirement) => {
            const prefix = requirement.type === 'document' ? 'Document' : 'Condition'
            const label = `${prefix}: ${requirement.name?.trim() || 'Requirement'}`
            acc[label] = summarizeRequirement(requirement)
            return acc
          },
          {},
        )

        const providerIdKey = String(row.provider_id as string | number)
        const providerEntry = providerMap[providerIdKey] || null

        return {
          id: String(row.id as string | number),
          rule_name: (row.rule_name as string) ?? '',
          description: (row.description as string | null | undefined) ?? null,
          classification: (row.classification as string | null | undefined) ?? null,
          subsidy_amount:
            row.subsidy_amount !== null && row.subsidy_amount !== undefined
              ? Number(row.subsidy_amount as number)
              : undefined,
          provider_id: providerIdKey,
          created_at: row.created_at as string | undefined,
          conditions,
          requirements: requirementRows,
          provider: {
            agency_name: providerEntry?.agency_name || 'Unknown Provider',
            logo: providerEntry?.logo || defaultlogo,
            status: providerEntry?.status,
            program: providerEntry?.program,
          },
        }
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Error fetching rules:', message)
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
