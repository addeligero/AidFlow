<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
// @ts-ignore - Pinia alias resolution within SFC context
import { useUserStore } from '../../stores/users'
// @ts-ignore - Vue SFC module resolution
import AdminLayout from '../../layouts/AdminLayout.vue'
// @ts-ignore - Vue SFC module resolution
import RequirementManager from '../../components/Admin/RequirementManager.vue'
// @ts-ignore - Vue SFC module resolution
import RuleManager from '../../components/Admin/RuleManager.vue'

type RequirementExtra = Record<string, any> | string | null

type Requirement = {
  id: string
  name: string
  type: 'document' | 'condition'
  field_key?: string | null
  operator?: string | null
  value?: string | null
  description?: string | null
  extra?: RequirementExtra
  created_at?: string
}

const userStore = useUserStore()
const providerId = ref<string | null>(null)

const snackbar = ref<{ show: boolean; text: string; color: string }>({
  show: false,
  text: '',
  color: 'success',
})

const requirementManagerRef = ref<InstanceType<typeof RequirementManager> | null>(null)
const ruleManagerRef = ref<InstanceType<typeof RuleManager> | null>(null)

const requirements = ref<Requirement[]>([])

function notify(payload: { text: string; color?: string }) {
  snackbar.value = {
    show: true,
    text: payload.text,
    color: payload.color || 'success',
  }
}

function handleRequirementsLoaded(list: Requirement[]) {
  requirements.value = list
}

function refresh() {
  requirementManagerRef.value?.refresh?.()
  ruleManagerRef.value?.refresh?.()
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
            Manage reusable requirements and bundle them into rules for your applicants.
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

      <RequirementManager
        ref="requirementManagerRef"
        :provider-id="providerId"
        @notify="notify"
        @requirements-loaded="handleRequirementsLoaded"
      />

      <RuleManager
        ref="ruleManagerRef"
        :provider-id="providerId"
        :requirements="requirements"
        @notify="notify"
      />
    </v-container>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2500">
      {{ snackbar.text }}
    </v-snackbar>
  </AdminLayout>
</template>
