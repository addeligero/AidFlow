/// <reference types="vite/client" />
declare module '*.png' {
  const value: string
  export default value
}

declare module '*.jpg' {
  const value: string
  export default value
}
declare module '*.jpeg' {
  const value: string
  export default value
}

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>
  export default component
}

declare module '@/lib/Supabase' {
  import type { SupabaseClient } from '@supabase/supabase-js'
  const supabaseClient: SupabaseClient
  export default supabaseClient
}
