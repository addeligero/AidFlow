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

declare module '@/layouts/AdminLayout.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/components/Admin/RulesCard.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@/stores/users' {
  export function useUserStore(): any
}
