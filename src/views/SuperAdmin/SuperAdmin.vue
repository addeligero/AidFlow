<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { providersStore } from '@/stores/providers'
import supabase from '@/lib/Supabase'

const ps = providersStore()
const users = ref<any[]>([])
const usersLoading = ref(false)
const errorMsg = ref('')

const fetchUsers = async () => {
  usersLoading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('users')
    .select('id,first_name,last_name,email,created_at')
  if (error) {
    errorMsg.value = error.message
    users.value = []
  } else {
    users.value = data || []
  }
  usersLoading.value = false
}

const refreshAll = async () => {
  await Promise.all([ps.fetchProviders(), ps.fetchRules(), fetchUsers()])
}

onMounted(() => {
  refreshAll()
})

const totalUsers = computed(() => users.value.length)
const totalProviders = computed(() => ps.providers.length)
const totalRules = computed(() => ps.rules.length)

const recentProviders = computed(() =>
  [...ps.providers]
    .sort((a, b) => (b.status === 'pending' ? 1 : 0) - (a.status === 'pending' ? 1 : 0))
    .slice(0, 5),
)
const recentRules = computed(() => [...ps.rules].sort((a, b) => (b.id > a.id ? -1 : 1)).slice(0, 5))

// Moderation state
const loadingIds = ref<Set<string>>(new Set())
const snackbar = ref<{ show: boolean; text: string; color: string }>({
  show: false,
  text: '',
  color: 'success',
})
const rejectDialog = ref(false)
const rejectReason = ref('')
const rejectTargetId = ref<string | null>(null)
const rejectLoading = ref(false)

function openReject(id: string) {
  rejectTargetId.value = id
  rejectReason.value = ''
  rejectDialog.value = true
}

async function approveProvider(id: string) {
  try {
    loadingIds.value.add(id)
    const { error } = await supabase.from('providers').update({ status: 'approved' }).eq('id', id)
    if (error) throw error
    snackbar.value = { show: true, text: 'Provider approved', color: 'success' }
    await ps.fetchProviders()
  } catch (e: any) {
    snackbar.value = { show: true, text: e?.message || 'Failed to approve', color: 'error' }
  } finally {
    loadingIds.value.delete(id)
  }
}

async function rejectProvider() {
  if (!rejectTargetId.value) return

  rejectLoading.value = true
  try {
    const { error } = await supabase
      .from('providers')
      .update({ status: 'rejected', rejection_reason: rejectReason.value || null })
      .eq('id', rejectTargetId.value)

    if (error) {
      const retry = await supabase
        .from('providers')
        .update({ status: 'rejected' })
        .eq('id', rejectTargetId.value)
      if (retry.error) throw retry.error
    }

    const { data: relatedUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, first_name')
      .eq('id', rejectTargetId.value)

    if (usersError) {
      console.warn('⚠️ Could not fetch provider users:', usersError.message)
    } else if (relatedUsers?.length) {
      for (const user of relatedUsers) {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-rejection-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            firstName: user.first_name,
            reason: rejectReason.value,
          }),
        })
      }
    }

    snackbar.value = { show: true, text: 'Provider rejected', color: 'success' }
    rejectDialog.value = false
    rejectTargetId.value = null
    rejectReason.value = ''
    await ps.fetchProviders()
  } catch (e: any) {
    snackbar.value = { show: true, text: e?.message || 'Failed to reject', color: 'error' }
  } finally {
    rejectLoading.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <v-container fluid class="py-4">
      <div class="d-flex align-center mb-4">
        <h2 class="text-h6 text-md-h5 me-3">Super Admin Dashboard</h2>
        <v-spacer />
        <v-btn size="small" variant="text" prepend-icon="mdi-refresh" @click="refreshAll">
          Refresh
        </v-btn>
      </div>

      <v-alert v-if="errorMsg" type="error" class="mb-4">{{ errorMsg }}</v-alert>

      <v-row class="mb-6">
        <v-col cols="12" md="4">
          <v-card color="primary" variant="tonal" class="pa-4">
            <div class="text-h5 font-weight-bold">{{ totalUsers }}</div>
            <div class="text-caption">Total Users</div>
          </v-card>
        </v-col>
        <v-col cols="12" md="4">
          <v-card color="secondary" variant="tonal" class="pa-4">
            <div class="text-h5 font-weight-bold">{{ totalProviders }}</div>
            <div class="text-caption">Total Providers</div>
          </v-card>
        </v-col>
        <v-col cols="12" md="4">
          <v-card color="success" variant="tonal" class="pa-4">
            <div class="text-h5 font-weight-bold">{{ totalRules }}</div>
            <div class="text-caption">Total Rules</div>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" md="6">
          <v-card class="mb-4">
            <v-card-title>Recent Provider Applications</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item v-for="p in recentProviders" :key="p.id">
                <template #prepend>
                  <v-avatar size="32" v-if="p.logo">
                    <img :src="p.logo" alt="logo" />
                  </v-avatar>
                </template>
                <v-list-item-title>{{ p.agency_name }}</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip
                    :color="
                      p.status === 'approved'
                        ? 'success'
                        : p.status === 'pending'
                          ? 'warning'
                          : 'error'
                    "
                    size="x-small"
                  >
                    {{ p.status }}
                  </v-chip>
                </v-list-item-subtitle>
                <template #append>
                  <div v-if="p.status === 'pending'" class="d-flex ga-2">
                    <v-btn
                      size="x-small"
                      color="success"
                      variant="tonal"
                      :loading="loadingIds.has(p.id)"
                      @click="approveProvider(p.id)"
                    >
                      Approve
                    </v-btn>
                    <v-btn size="x-small" color="error" variant="tonal" @click="openReject(p.id)">
                      Reject
                    </v-btn>
                  </div>
                </template>
              </v-list-item>
              <v-list-item v-if="ps.providersLoading">
                <v-skeleton-loader type="list-item-avatar, list-item-two-line" />
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card class="mb-4">
            <v-card-title>Recent Rules</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item v-for="r in recentRules" :key="r.id">
                <v-list-item-title>{{ r.rule_name }}</v-list-item-title>
                <v-list-item-subtitle>
                  <span v-if="r.provider">{{ r.provider.agency_name }}</span>
                  <span v-else>Unknown Provider</span>
                </v-list-item-subtitle>
                <template #append>
                  <v-chip size="x-small" color="primary">{{ r.subsidy_amount ?? '—' }}</v-chip>
                </template>
              </v-list-item>
              <v-list-item v-if="ps.rulesLoading">
                <v-skeleton-loader type="list-item-two-line" />
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>
      </v-row>

      <!-- Reject dialog -->
      <v-dialog v-model="rejectDialog" max-width="520">
        <v-card>
          <v-card-title class="text-h6">Reject Provider</v-card-title>
          <v-card-text>
            <p class="text-body-2">Optionally add a reason for rejection:</p>
            <v-textarea v-model="rejectReason" label="Reason" rows="4" auto-grow />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="rejectDialog = false">Cancel</v-btn>
            <v-btn color="error" :loading="rejectLoading" @click="rejectProvider">Reject</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2500">
        {{ snackbar.text }}
      </v-snackbar>
    </v-container>
  </AdminLayout>
</template>
