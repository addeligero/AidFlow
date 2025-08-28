<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import supabase from '@/lib/Supabase'
import { useUserStore } from '@/stores/users'

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

async function fetchMyRules(providerId: string) {
  try {
    loading.value = true
    errorMsg.value = ''
    const { data, error } = await supabase
      .from('subsidy_rules')
      .select('id, rule_name, subsidy_amount, conditions, created_at')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })

    if (error) throw error
    rules.value = (data || []) as MyRule[]
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load rules.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  userStore.fetchUser()
})

watch(
  () => userStore.user_id,
  (id) => {
    if (id) fetchMyRules(id)
  },
  { immediate: true },
)

const totalConditions = (r: MyRule) => Object.keys(r.conditions || {}).length
const hasRules = computed(() => !loading.value && rules.value.length > 0)

function refresh() {
  if (userStore.user_id) fetchMyRules(userStore.user_id)
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
</script>

<template>
  <v-container fluid class="py-4">
    <div class="d-flex align-center mb-4">
      <h2 class="text-h6 text-md-h5 me-3">My Rules</h2>
      <v-chip v-if="rules.length" size="small" color="primary" variant="flat">
        {{ rules.length }} total
      </v-chip>
      <v-spacer />
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
        <v-card class="flex-grow-1 d-flex flex-column" :title="r.rule_name">
          <v-card-item>
            <v-card-title class="text-subtitle-1">{{ r.rule_name }}</v-card-title>
            <v-card-subtitle class="d-flex align-center flex-wrap ga-2">
              <v-chip size="x-small" color="primary" variant="flat">
                Amount: {{ r.subsidy_amount ?? '—' }}
              </v-chip>
              <v-chip size="x-small" color="secondary" variant="tonal">
                {{ totalConditions(r) }} conditions
              </v-chip>
              <span class="text-caption text-medium-emphasis ms-auto" v-if="r.created_at">
                {{ new Date(r.created_at).toLocaleString() }}
              </span>
            </v-card-subtitle>
          </v-card-item>

          <v-divider />
          <v-card-text>
            <div v-if="totalConditions(r)">
              <v-table density="compact">
                <thead>
                  <tr>
                    <th class="text-caption text-medium-emphasis">Condition</th>
                    <th class="text-caption text-medium-emphasis">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(val, key) in r.conditions" :key="key">
                    <td class="text-body-2 font-weight-medium">{{ key }}</td>
                    <td class="text-body-2">{{ val }}</td>
                  </tr>
                </tbody>
              </v-table>
            </div>
            <div v-else class="text-caption text-medium-emphasis">No conditions defined.</div>
          </v-card-text>

          <v-divider />
          <v-card-actions>
            <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-pencil">
              Edit
            </v-btn>
            <v-spacer />
            <v-tooltip text="Copy JSON" location="top">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon size="small" @click="copyRule(r)">
                  <v-icon size="18">mdi-content-copy</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-empty-state
      v-else
      icon="mdi-clipboard-list-outline"
      title="No rules yet"
      text="Create your first rule to see it here."
    />
  </v-container>
</template>
