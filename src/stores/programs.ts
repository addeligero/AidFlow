import { ref } from 'vue'
import { defineStore } from 'pinia'
import supabase from '@/lib/Supabase'

export type RequirementType = 'document' | 'condition'
export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'less_than'
  | 'less_or_equal'
  | 'greater_than'
  | 'greater_or_equal'
  | 'includes'
  | 'exists'

export type RequirementItem = {
  type: RequirementType
  name: string
  description?: string | null
  field_key?: string | null
  operator?: RuleOperator | null
  value?: string | number | boolean | null
}

export type RuleItem = {
  field: string
  operator: RuleOperator
  value: string | number | boolean | null
  note?: string | null
}

export type Program = {
  id: string
  provider_id: string | number
  name: string
  category?: string | null
  description?: string | null
  requirements: RequirementItem[]
  rules: RuleItem[]
  created_at?: string
  updated_at?: string
}

function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v
  if (v === null || v === undefined) return fallback
  return String(v)
}

function toRequirementItem(raw: unknown): RequirementItem {
  const r = (raw ?? {}) as Record<string, unknown>
  const type = r.type === 'condition' ? 'condition' : 'document'
  return {
    type,
    name: asString(r.name),
    description: (typeof r.description === 'string' ? r.description : null) as string | null,
    field_key: r.field_key ? asString(r.field_key) : null,
    operator: (r.operator as RuleOperator | null) ?? null,
    value: (r as Record<string, unknown>)['value'] as string | number | boolean | null | undefined,
  }
}

function toRuleItem(raw: unknown): RuleItem {
  const r = (raw ?? {}) as Record<string, unknown>
  const value = (r as Record<string, unknown>)['value'] as
    | string
    | number
    | boolean
    | null
    | undefined
  const operator = (r.operator as RuleOperator) ?? 'equals'
  return {
    field: asString(r.field),
    operator,
    value: value ?? null,
    note: (typeof r.note === 'string' ? r.note : null) as string | null,
  }
}

export const useProgramsStore = defineStore('programs', () => {
  const programs = ref<Program[]>([])
  const loading = ref(false)

  async function fetchPrograms() {
    if (loading.value) return
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('programs')
        .select(
          'id, provider_id, name, category, description, requirements, rules, created_at, updated_at',
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data || []) as Array<Record<string, unknown>>
      programs.value = rows.map((row) => ({
        id: String(row.id as string | number),
        provider_id: (row.provider_id as string | number)!,
        name: asString(row.name),
        category: (row.category as string | null | undefined) ?? null,
        description: (row.description as string | null | undefined) ?? null,
        requirements: Array.isArray(row.requirements)
          ? (row.requirements as unknown[]).map(toRequirementItem)
          : [],
        rules: Array.isArray(row.rules) ? (row.rules as unknown[]).map(toRuleItem) : [],
        created_at: row.created_at as string | undefined,
        updated_at: row.updated_at as string | undefined,
      }))
    } catch (e: unknown) {
      console.error('Failed to fetch programs:', e)
      programs.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchProgramsByProvider(providerId: string | number) {
    if (loading.value) return
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('programs')
        .select(
          'id, provider_id, name, category, description, requirements, rules, created_at, updated_at',
        )
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data || []) as Array<Record<string, unknown>>
      programs.value = rows.map((row) => ({
        id: String(row.id as string | number),
        provider_id: (row.provider_id as string | number)!,
        name: asString(row.name),
        category: (row.category as string | null | undefined) ?? null,
        description: (row.description as string | null | undefined) ?? null,
        requirements: Array.isArray(row.requirements)
          ? (row.requirements as unknown[]).map(toRequirementItem)
          : [],
        rules: Array.isArray(row.rules) ? (row.rules as unknown[]).map(toRuleItem) : [],
        created_at: row.created_at as string | undefined,
        updated_at: row.updated_at as string | undefined,
      }))
    } catch (e: unknown) {
      console.error('Failed to fetch programs by provider:', e)
      programs.value = []
    } finally {
      loading.value = false
    }
  }

  function clearPrograms() {
    programs.value = []
  }

  type ProgramInsert = {
    provider_id: string | number
    name: string
    category: string | null
    description: string | null
    requirements: unknown[]
    rules: unknown[]
    updated_at?: string
  }

  async function createProgram(payload: ProgramInsert) {
    const { error } = await supabase.from('programs').insert([payload])
    if (error) throw error
  }

  async function updateProgram(id: string | number, payload: ProgramInsert) {
    const { error } = await supabase.from('programs').update(payload).eq('id', id)
    if (error) throw error
  }

  async function deleteProgram(id: string | number, providerId?: string | number) {
    let q = supabase.from('programs').delete().eq('id', id)
    if (providerId !== undefined && providerId !== null) {
      q = q.eq('provider_id', providerId)
    }
    const { error } = await q
    if (error) throw error
  }

  async function saveTrainingResult(input: {
    program_id: string | number
    accuracy?: number | null
    feature_schema?: string[] | null
    rules_text?: string | null
    rules_for_generator?: string | null
    numbered_notes?: string[] | null
    file_path?: string | null
    csv_path?: string | null
  }) {
    const notesParts = [
      input.rules_for_generator ? `Generator guidance: ${input.rules_for_generator}` : null,
      Array.isArray(input.numbered_notes) ? input.numbered_notes.join('\n') : null,
    ].filter(Boolean)
    const row = {
      program_id: input.program_id,
      accuracy: input.accuracy ?? null,
      features: input.feature_schema ?? null,
      rules_summary: input.rules_text ?? null,
      notes: notesParts.length ? notesParts.join('\n\n') : null,
      model_path: input.file_path ?? null,
      csv_path: input.csv_path ?? null,
    }
    const { error } = await supabase.from('model_training_results').insert([row])
    if (error) throw error
  }

  type ModelTrainingResult = {
    id: number
    program_id: number
    accuracy: number | null
    features: string[] | null
    rules_summary: string | null
    notes: string | null
    model_path: string | null
    csv_path: string | null
    created_at: string
  }

  async function fetchLatestTrainingResult(
    programId: string | number,
  ): Promise<ModelTrainingResult | null> {
    const { data, error } = await supabase
      .from('model_training_results')
      .select(
        'id, program_id, accuracy, features, rules_summary, notes, model_path, csv_path, created_at',
      )
      .eq('program_id', programId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error && error.details !== 'Results contain 0 rows') throw error
    return (data as unknown as ModelTrainingResult) || null
  }

  return {
    programs,
    loading,
    fetchPrograms,
    fetchProgramsByProvider,
    clearPrograms,
    createProgram,
    updateProgram,
    deleteProgram,
    saveTrainingResult,
    fetchLatestTrainingResult,
  }
})
