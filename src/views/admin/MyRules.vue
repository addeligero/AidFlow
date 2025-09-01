<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import supabase from '@/lib/Supabase'
import { useUserStore } from '@/stores/users'
import AdminLayout from '@/layouts/AdminLayout.vue'
import RulesCard from '@/components/Admin/RulesCard.vue'

type MyRule = {
  id: string
  rule_name: string
  subsidy_amount: number | null
  conditions: Record<string, any>
  created_at?: string
}

const userStore = useUserStore()
const loading = ref(false)
const errorMsg = ref('')
const rules = ref<MyRule[]>([])

type KV = { key: string; value: any }
const editorOpen = ref(false)
const editorLoading = ref(false)
const isEdit = ref(false)
const currentId = ref<string | null>(null)
const formName = ref('')
const formAmount = ref<number | null>(null)
const formConds = ref<KV[]>([])
const confirmDeleteOpen = ref(false)
const toDeleteId = ref<string | null>(null)
const snackbar = ref<{ show: boolean; text: string; color: string }>({
  show: false,
  text: '',
  color: 'success',
})

const providerId = ref<string | null>(null)
const channel = ref<any | null>(null)

async function fetchProviderId() {
  if (!userStore.user_id) return
  const { data, error } = await supabase
    .from('providers')
    .select('id')
    .eq('id', userStore.user_id)
    .single()
  if (error) {
    console.error('Provider not found:', error.message)
    providerId.value = null
  } else {
    providerId.value = data?.id || null
  }
}

async function fetchMyRules() {
  if (!providerId.value) return
  try {
    loading.value = true
    errorMsg.value = ''
    const { data, error } = await supabase
      .from('subsidy_rules')
      .select('id, rule_name, subsidy_amount, conditions, created_at')
      .eq('provider_id', providerId.value)
      .order('created_at', { ascending: false })

    if (error) throw error
    rules.value = (data || []) as MyRule[]
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load rules.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await userStore.fetchUser()
  await fetchProviderId()
  if (providerId.value) await fetchMyRules()

  // Realtime subscription for rules
  if (providerId.value) {
    channel.value = supabase
      .channel('rules-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subsidy_rules',
          filter: `provider_id=eq.${providerId.value}`,
        },
        (payload) => {
          console.log('Rule change detected:', payload)
          fetchMyRules()
        },
      )
      .subscribe()
  }
})

onBeforeUnmount(() => {
  if (channel.value) supabase.removeChannel(channel.value)
})

watch(
  () => userStore.user_id,
  async (id) => {
    if (id) {
      await fetchProviderId()
      if (providerId.value) await fetchMyRules()
    }
  },
  { immediate: true },
)

const hasRules = computed(() => !loading.value && rules.value.length > 0)

function refresh() {
  if (providerId.value) fetchMyRules()
}

function copyRule(rule: MyRule) {
  try {
    const json = JSON.stringify(rule, null, 2)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(json)
    }
  } catch {
    console.error('Failed to copy rule to clipboard.')
  }
}

function objToPairs(obj: Record<string, any> | null | undefined): KV[] {
  if (!obj) return []
  return Object.keys(obj).map((k) => ({ key: k, value: (obj as any)[k] }))
}
function pairsToObj(pairs: KV[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const { key, value } of pairs) {
    if (!key) continue
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue
    out[key] = value
  }
  return out
}

// CRUD Actions
function openCreate() {
  isEdit.value = false
  currentId.value = null
  formName.value = ''
  formAmount.value = null
  formConds.value = []
  editorOpen.value = true
}

function openEdit(r: MyRule) {
  isEdit.value = true
  currentId.value = r.id
  formName.value = r.rule_name
  formAmount.value = r.subsidy_amount ?? null
  formConds.value = objToPairs(r.conditions)
  editorOpen.value = true
}

function addCond() {
  formConds.value.push({ key: '', value: '' })
}
function removeCond(i: number) {
  formConds.value.splice(i, 1)
}

async function saveRule() {
  if (!providerId.value) return
  editorLoading.value = true
  try {
    if (!formName.value.trim()) throw new Error('Rule name is required')
    if (formConds.value.some((c) => !c.key)) throw new Error('Condition keys cannot be empty')

    const payload = {
      provider_id: providerId.value,
      rule_name: formName.value.trim(),
      subsidy_amount: formAmount.value,
      conditions: pairsToObj(formConds.value),
    }

    if (isEdit.value && currentId.value) {
      const { error } = await supabase
        .from('subsidy_rules')
        .update({
          rule_name: payload.rule_name,
          subsidy_amount: payload.subsidy_amount,
          conditions: payload.conditions,
        })
        .eq('id', currentId.value)
        .eq('provider_id', providerId.value)
      if (error) throw error
      snackbar.value = { show: true, text: 'Rule updated', color: 'success' }
    } else {
      const { error } = await supabase.from('subsidy_rules').insert([payload])
      if (error) throw error
      snackbar.value = { show: true, text: 'Rule created', color: 'success' }
    }
    editorOpen.value = false
    await refresh()
  } catch (e: any) {
    snackbar.value = { show: true, text: e?.message || 'Save failed', color: 'error' }
  } finally {
    editorLoading.value = false
  }
}

function confirmDelete(id: string) {
  toDeleteId.value = id
  confirmDeleteOpen.value = true
}

async function deleteRule() {
  if (!toDeleteId.value || !providerId.value) return
  try {
    const { error } = await supabase
      .from('subsidy_rules')
      .delete()
      .eq('id', toDeleteId.value)
      .eq('provider_id', providerId.value)
    if (error) throw error
    snackbar.value = { show: true, text: 'Rule deleted', color: 'success' }
    confirmDeleteOpen.value = false
    toDeleteId.value = null
    await refresh()
  } catch (e: any) {
    snackbar.value = { show: true, text: e?.message || 'Delete failed', color: 'error' }
  }
}
</script>

<template>
  <AdminLayout>
    <v-container fluid class="py-4">
      <div class="d-flex align-center mb-4">
        <h2 class="text-h6 text-md-h5 me-3">My Rules</h2>
        <v-chip v-if="rules.length" size="small" color="primary" variant="flat">
          {{ rules.length }} total
        </v-chip>
        <v-spacer />
        <v-btn
          size="small"
          color="primary"
          prepend-icon="mdi-plus"
          class="me-2"
          @click="openCreate"
        >
          New Rule
        </v-btn>
        <v-btn size="small" variant="text" prepend-icon="mdi-refresh" @click="refresh">
          Refresh
        </v-btn>
      </div>

      <v-alert v-if="errorMsg" type="error" class="mb-4">{{ errorMsg }}</v-alert>

      <v-row v-if="loading" class="mb-4">
        <v-col cols="12" md="6" lg="4" v-for="i in 6" :key="i">
          <v-skeleton-loader type="card, actions" />
        </v-col>
      </v-row>

      <v-row v-else-if="hasRules">
        <v-col cols="12" md="6" lg="4" v-for="r in rules" :key="r.id" class="d-flex">
          <RulesCard
            class="flex-grow-1"
            :rule="r"
            amount-label="Amount"
            conditions-label="conditions"
            empty-conditions-text="No conditions defined."
            @edit="openEdit"
            @delete="confirmDelete"
            @copy="copyRule"
          />
        </v-col>
      </v-row>

      <v-empty-state
        v-else
        icon="mdi-clipboard-list-outline"
        title="No rules yet"
        text="Create your first rule to see it here."
      />
    </v-container>

    <!-- Editor Dialog -->
    <v-dialog v-model="editorOpen" max-width="640">
      <v-card>
        <v-card-title class="text-h6">{{ isEdit ? 'Edit Rule' : 'New Rule' }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="saveRule">
            <v-text-field v-model="formName" label="Rule Name" required />
            <v-text-field v-model.number="formAmount" label="Subsidy Amount" type="number" />
            <div class="d-flex align-center mt-2 mb-1">
              <h4 class="text-subtitle-2 me-2">Conditions</h4>
              <v-spacer />
              <v-btn size="small" variant="text" prepend-icon="mdi-plus" @click="addCond"
                >Add</v-btn
              >
            </div>
            <div v-for="(c, i) in formConds" :key="i" class="d-flex ga-2 mb-2">
              <v-text-field v-model="c.key" label="Key (e.g. min_income)" density="comfortable" />
              <v-text-field v-model="c.value" label="Value" density="comfortable" />
              <v-btn icon color="error" @click="removeCond(i)"><v-icon>mdi-delete</v-icon></v-btn>
            </div>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editorOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="editorLoading" @click="saveRule">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirm Dialog -->
    <v-dialog v-model="confirmDeleteOpen" max-width="420">
      <v-card>
        <v-card-title class="text-h6">Delete Rule</v-card-title>
        <v-card-text>Are you sure you want to delete this rule?</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmDeleteOpen = false">Cancel</v-btn>
          <v-btn color="error" @click="deleteRule">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2500">
      {{ snackbar.text }}
    </v-snackbar>
  </AdminLayout>
</template>
