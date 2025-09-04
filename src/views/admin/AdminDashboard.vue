<script setup lang="ts">
import { computed, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AdminCard from '@/components/Admin/AdminCard.vue'
import DashboardChart from '@/views/admin/DashboardChart.vue'
import { useUserStore } from '@/stores/users'
import { providersStore } from '@/stores/providers'
import defaultlogo from '@/assets/img/logo/defaultlogo.jp.jpg'

const userStore = useUserStore()
const provStore = providersStore()

onMounted(async () => {
  if (!userStore.isUserLoaded) await userStore.fetchUser()
  if (!provStore.providers.length) await provStore.fetchProviders()
})

const currentProvider = computed(() => {
  const uid = userStore.user_id
  if (!uid) return null
  return provStore.providers.find((p) => String(p.id) === String(uid)) || null
})

const displayName = computed(() => currentProvider.value?.agency_name || userStore.userFullName)
const displayLogo = computed(
  () => currentProvider.value?.logo || userStore.userProfileImg || (defaultlogo as string),
)
</script>
<template>
  <AdminLayout>
    <v-card class="mb-4 pa-4 d-flex align-center" rounded="lg" variant="tonal">
      <v-avatar size="64" class="mr-4">
        <v-img :src="displayLogo" alt="Admin logo" cover />
      </v-avatar>
      <div>
        <h2 class="text-h6 text-md-h5 mb-1">{{ displayName }}</h2>
        <div class="text-caption text-medium-emphasis">Admin dashboard</div>
      </div>
    </v-card>

    <DashboardChart />
    <br />
    <hr />
    <br />
    <AdminCard
      title="Rules"
      subHeader="Empower Your Community"
      shortStatement="Click below to add or update your community guidelines."
      buttonText="View Rules Here"
    />
  </AdminLayout>
</template>
