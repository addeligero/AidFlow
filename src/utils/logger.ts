import supabase from '@/lib/Supabase'

export type UserRole = 'CLIENT' | 'ADMIN' | 'SUPER_ADMIN' | 'SYSTEM'

interface LogEntry {
  role: UserRole
  action: string
  details?: string
}

export async function logAction(
  role: UserRole,
  action: string,
  details: string = '',
): Promise<void> {
  try {
    const { error } = await supabase.from('logs').insert([{ role, action, details }])

    if (error) throw error

    console.log(`✅ [${role}] ${action}${details ? ' | ' + details : ''}`)
  } catch (err: any) {
    console.error('❌ Log failed:', err.message)
  }
}
