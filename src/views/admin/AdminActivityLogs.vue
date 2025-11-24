<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import supabase from '../../lib/Supabase'
import { useUserStore } from '../../stores/users'
import AdminLayout from '@/layouts/AdminLayout.vue'

interface LogEntry {
  id?: number
  table_name: string
  record_id: string | number | null
  action: string
  provider_id: number | string | null
  performed_by: number | string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at?: string
}

const loading = ref(false)
const error = ref<string | null>(null)
const logs = ref<LogEntry[]>([])
const userStore = useUserStore()
const expanded = ref<Set<number | string>>(new Set())

function toggleExpand(row: LogEntry, idx: number) {
  const key = row.id ?? idx
  if (expanded.value.has(key)) {
    expanded.value.delete(key)
  } else {
    expanded.value.add(key)
  }
  // Clone Set to trigger Vue reactivity
  expanded.value = new Set(expanded.value)
}

const sortedLogs = computed(() => {
  return [...logs.value].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })
})

function formatTimestamp(ts?: string) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString()
}

// Legacy raw diff (kept for reference if needed later)
// function summarizeChange(entry: LogEntry) { ... }

// Friendlier summary for non-technical users
type GenericObj = Record<string, unknown>

function summarizeChangeFriendly(entry: LogEntry) {
  if (!entry.old_data && !entry.new_data) return 'No data'
  const oldObj: GenericObj = entry.old_data || {}
  const newObj: GenericObj = entry.new_data || {}
  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
  const parts: string[] = []

  const fmtPrimitive = (v: unknown) => {
    if (v === null || v === undefined) return 'empty'
    if (typeof v === 'string') {
      if (v.length > 40) return v.slice(0, 37) + '…'
      return v
    }
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return typeof v
  }

  for (const k of keys) {
    const o = oldObj[k]
    const n = newObj[k]
    if (JSON.stringify(o) === JSON.stringify(n)) continue

    // Handle arrays
    if (Array.isArray(o) || Array.isArray(n)) {
      const oldArr = Array.isArray(o) ? o : []
      const newArr = Array.isArray(n) ? n : []
      // If array of objects with `name` key, diff by name
      const isObjArray = newArr.every((it) => typeof it === 'object' && it !== null)
      if (isObjArray) {
        const oldByName = new Map<string, GenericObj>()
        const newByName = new Map<string, GenericObj>()
        for (const item of oldArr) {
          const name =
            item && typeof item === 'object' && 'name' in item
              ? String((item as GenericObj).name as string)
              : JSON.stringify(item)
          if (item && typeof item === 'object') oldByName.set(name, item as GenericObj)
        }
        for (const item of newArr) {
          const name =
            item && typeof item === 'object' && 'name' in item
              ? String((item as GenericObj).name as string)
              : JSON.stringify(item)
          if (item && typeof item === 'object') newByName.set(name, item as GenericObj)
        }
        const added: string[] = []
        const removed: string[] = []
        const changed: string[] = []
        for (const name of newByName.keys()) {
          if (!oldByName.has(name)) added.push(name)
          else {
            const before = oldByName.get(name)
            const after = newByName.get(name)
            if (JSON.stringify(before) !== JSON.stringify(after)) {
              // Detect which fields changed (limit to a few)
              if (before && after && typeof before === 'object' && typeof after === 'object') {
                const beforeObj = before as GenericObj
                const afterObj = after as GenericObj
                const fKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])
                const fieldDiffs: string[] = []
                for (const fk of fKeys) {
                  if (JSON.stringify(beforeObj[fk]) !== JSON.stringify(afterObj[fk]))
                    fieldDiffs.push(fk)
                }
                changed.push(
                  `${name} (${fieldDiffs.slice(0, 4).join(', ')}` +
                    (fieldDiffs.length > 4 ? ', …' : '') +
                    ')',
                )
              } else changed.push(name)
            }
          }
        }
        for (const name of oldByName.keys()) {
          if (!newByName.has(name)) removed.push(name)
        }
        const seg: string[] = []
        if (added.length) seg.push(`+${added.length} added`) // e.g. +2 added
        if (removed.length) seg.push(`-${removed.length} removed`)
        if (changed.length) seg.push(`${changed.length} modified`)
        if (!seg.length) seg.push('no item changes')
        parts.push(`${k}: ${seg.join(', ')}`)
      } else {
        // Primitive array diff counts
        const added = newArr.filter((v) => !oldArr.includes(v))
        const removed = oldArr.filter((v) => !newArr.includes(v))
        const seg: string[] = []
        if (added.length) seg.push(`+${added.length}`)
        if (removed.length) seg.push(`-${removed.length}`)
        if (!seg.length && oldArr.length !== newArr.length)
          seg.push(`size ${oldArr.length}→${newArr.length}`)
        if (!seg.length) seg.push('no item changes')
        parts.push(`${k}: ${seg.join(', ')}`)
      }
      continue
    }

    // Handle plain objects
    if (o && n && typeof o === 'object' && typeof n === 'object') {
      const oObj = o as GenericObj
      const nObj = n as GenericObj
      const oKeys = Object.keys(oObj)
      const nKeys = Object.keys(nObj)
      const addedKeys = nKeys.filter((kk) => !oKeys.includes(kk))
      const removedKeys = oKeys.filter((kk) => !nKeys.includes(kk))
      const changedKeys: string[] = []
      for (const kk of oKeys) {
        if (nKeys.includes(kk) && JSON.stringify(oObj[kk]) !== JSON.stringify(nObj[kk]))
          changedKeys.push(kk)
      }
      const seg: string[] = []
      if (addedKeys.length) seg.push(`+${addedKeys.length} field(s)`)
      if (removedKeys.length) seg.push(`-${removedKeys.length} field(s)`)
      if (changedKeys.length) seg.push(`${changedKeys.length} modified`)
      if (!seg.length) seg.push('structure changed')
      parts.push(`${k}: ${seg.join(', ')}`)
      continue
    }

    // Primitive value change
    parts.push(`${k}: ${fmtPrimitive(o)} → ${fmtPrimitive(n)}`)
  }

  return parts.length ? parts.join('; ') : 'No field changes'
}

onMounted(async () => {
  loading.value = true
  try {
    if (!userStore.isUserLoaded) await userStore.fetchUser()
    // Supabase auth UUID (userStore.user?.id) is NOT the numeric provider_id.
    // We stored the numeric/serial id from the users table in userStore.user_id.
    // Use that for provider_id filtering to avoid type mismatch (400 Bad Request).
    const providerNumericId = userStore.user_id
    if (!providerNumericId) throw new Error('Missing provider numeric id')
    const { data, error: qErr } = await supabase
      .from('logs')
      .select('*')
      .eq('provider_id', providerNumericId)

    if (qErr) throw qErr
    logs.value = (data as LogEntry[]) || []
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center mb-4">
      <h2 class="text-h6 mb-0">Activity Logs</h2>
      <v-spacer />
      <v-btn size="small" variant="outlined" :disabled="loading" @click="$router.go(0)">
        Refresh
      </v-btn>
    </div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-table density="comfortable" v-if="sortedLogs.length">
      <thead>
        <tr>
          <th style="width: 140px">Timestamp</th>
          <th style="width: 110px">Action</th>
          <th style="width: 120px">Table</th>
          <th style="width: 120px">Record</th>
          <th>Summary</th>
          <th style="width: 70px">Details</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(row, idx) in sortedLogs" :key="row.id ?? idx">
          <tr>
            <td class="text-caption">{{ formatTimestamp(row.created_at) }}</td>
            <td>
              <v-chip size="x-small" color="primary" variant="tonal">{{ row.action }}</v-chip>
            </td>
            <td class="text-caption">{{ row.table_name }}</td>
            <td class="text-caption text-wrap">{{ row.record_id || '—' }}</td>
            <td class="text-caption" style="white-space: normal">
              {{ summarizeChangeFriendly(row) }}
            </td>
            <td>
              <v-btn size="x-small" variant="text" @click="toggleExpand(row, idx)">
                {{ expanded.has(row.id ?? idx) ? 'Hide' : 'View' }}
              </v-btn>
            </td>
          </tr>
          <tr v-if="expanded.has(row.id ?? idx)" :key="'details-' + (row.id ?? idx)">
            <td colspan="6" class="bg-grey-lighten-4">
              <div class="text-caption">
                <strong>Old Data:</strong>
                <pre class="log-pre">{{ JSON.stringify(row.old_data, null, 2) }}</pre>
              </div>
              <div class="text-caption mt-2">
                <strong>New Data:</strong>
                <pre class="log-pre">{{ JSON.stringify(row.new_data, null, 2) }}</pre>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </v-table>
    <v-alert v-else-if="!loading" type="info" variant="tonal">No logs found.</v-alert>
  </div>
</template>

<style scoped>
.log-pre {
  margin: 0;
  padding: 8px;
  background: #1e1e1e;
  color: #ddd;
  border-radius: 4px;
  max-height: 300px;
  overflow: auto;
  font-size: 11px;
}
</style>
