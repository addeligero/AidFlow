declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '@/lib/Supabase' {
  import type { SupabaseClient } from '@supabase/supabase-js'
  const supabaseClient: SupabaseClient
  export default supabaseClient
}

declare module '@/layouts/AdminLayout.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '@/layouts/ClientLayout.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '@/components/Admin/RulesCard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '@/stores/users' {
  export function useUserStore(): unknown
}

declare module '@/stores/providers' {
  export function providersStore(): unknown
}

declare module '@/stores/programs' {
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
  export function useProgramsStore(): {
    programs: Program[]
    loading: boolean
    error: string | null
    fetchProgramsByProvider: (providerId?: string | number) => Promise<void>
  }
}
