<script setup lang="ts">
import { ref, watch, onMounted, defineAsyncComponent } from 'vue'
import { useUserStore } from '../../stores/users'
const AdminLayout = defineAsyncComponent(() => import('../../layouts/AdminLayout.vue'))
const ProgramManager = defineAsyncComponent(
  () => import('../../components/Admin/ProgramManager.vue'),
)

const userStore = useUserStore()
const providerId = ref<string | null>(null)

const snackbar = ref<{ show: boolean; text: string; color: string }>({
  show: false,
  text: '',
  color: 'success',
})

const programManagerRef = ref<{ refresh?: () => Promise<void> } | null>(null)

function notify(payload: { text: string; color?: string }) {
  snackbar.value = {
    show: true,
    text: payload.text,
    color: payload.color || 'success',
  }
}

function refresh() {
  programManagerRef.value?.refresh?.()
}

watch(
  () => userStore.user_id,
  (id) => {
    if (!id) return
    providerId.value = String(id)
  },
  { immediate: true },
)

onMounted(async () => {
  if (!userStore.isUserLoaded) {
    await userStore.fetchUser()
    if (userStore.user_id) {
      providerId.value = String(userStore.user_id)
    }
  }
})
</script>

<template>
  <AdminLayout>
    <v-container fluid class="py-4">
      <div class="d-flex align-center mb-6">
        <div>
          <h2 class="text-h6 text-md-h5 mb-1">My Subsidy Programs</h2>
          <p class="text-caption text-medium-emphasis mb-0">
            Manage your programs with their requirements and rules in one place.
          </p>
        </div>
        <v-spacer />
        <v-btn
          size="small"
          variant="text"
          prepend-icon="mdi-refresh"
          :disabled="!providerId"
          @click="refresh"
        >
          Refresh
        </v-btn>
      </div>

      <ProgramManager ref="programManagerRef" :provider-id="providerId" @notify="notify" />
    </v-container>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2500">
      {{ snackbar.text }}
    </v-snackbar>
  </AdminLayout>
</template>
