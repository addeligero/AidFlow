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
    .select('id,full_name,email,created_at,provider_id')
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
    </v-container>
  </AdminLayout>
</template>
