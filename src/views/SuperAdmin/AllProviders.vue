<script setup lang="ts">
import { onMounted, computed } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { providersStore } from '@/stores/providers'

const ps = providersStore()

onMounted(async () => {
  if (!ps.providers.length) await ps.fetchProviders()
})

const headers = [
  { title: 'Agency', key: 'agency_name' },
  { title: 'Status', key: 'status' },
  { title: 'Created', key: 'created_at' },
  { title: 'Contact', key: 'contact_person' },
  { title: 'Agency Email', key: 'agency_email' },
  { title: 'Agency Number', key: 'agency_number' },
  { title: 'Office Address', key: 'office_address' },
]

const items = computed(() => ps.providers)
const loading = computed(() => (ps as any).providersLoading || false)
</script>

<template>
  <AdminLayout>
    <v-container fluid class="py-4">
      <div class="d-flex align-center mb-4">
        <h2 class="text-h6 text-md-h5 me-3">All Providers</h2>
        <v-spacer />
        <v-btn to="/super" prepend-icon="mdi-arrow-left" variant="text">Back</v-btn>
      </div>

      <v-card>
        <v-table density="comfortable">
          <thead>
            <tr>
              <th class="text-left">Agency</th>
              <th class="text-left">Status</th>
              <th class="text-left">Created</th>
              <th class="text-left">Contact</th>
              <th class="text-left">Agency Email</th>
              <th class="text-left">Agency Number</th>
              <th class="text-left">Office Address</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in items" :key="p.id">
              <td>
                <div class="d-flex align-center">
                  <v-avatar v-if="p.logo" size="28" class="mr-2">
                    <img :src="p.logo" alt="logo" />
                  </v-avatar>
                  <span>{{ p.agency_name }}</span>
                </div>
              </td>
              <td>
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
              </td>
              <td>
                <span class="text-caption">{{ p.created_at || '—' }}</span>
              </td>
              <td>
                <span class="text-caption">{{ p.contact_person || '—' }}</span>
              </td>
              <td>
                <span class="text-caption">{{ p.agency_email || '—' }}</span>
              </td>
              <td>
                <span class="text-caption">{{ p.agency_num || '—' }}</span>
              </td>
              <td>
                <span class="text-caption">{{ p.office_address || '—' }}</span>
              </td>
            </tr>
            <tr v-if="loading">
              <td colspan="3">
                <v-skeleton-loader type="table-row@3" />
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </v-container>
  </AdminLayout>
</template>

<style scoped></style>
