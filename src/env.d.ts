declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/lib/Supabase' {
  import type { SupabaseClient } from '@supabase/supabase-js'
  const supabaseClient: SupabaseClient
  export default supabaseClient
}

// Intentionally avoid overriding store module types; rely on actual TS files for strong typing.
