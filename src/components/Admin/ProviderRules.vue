<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import supabase from '@/lib/Supabase'
import { useUserStore } from '@/stores/users'
import { providersStore } from '@/stores/providers'

const router = useRouter()
const store = providersStore()
const userStore = useUserStore()

onMounted(() => {
  userStore.fetchUser()
})

const ruleName = ref('')
const subsidyAmount = ref<number | null>(null)
const conditions = ref<{ key: string; value: any }[]>([])

const loading = ref(false)
const success = ref(false)
const errorMessage = ref('')
const requested = ref(false)
const addCondition = () => {
  conditions.value.push({ key: '', value: '' })
}

const removeCondition = (index: number) => {
  conditions.value.splice(index, 1)
}
const buildConditionsJson = () => {
  const obj: Record<string, any> = {}
  conditions.value.forEach((c) => {
    if (c.key) obj[c.key] = c.value
  })
  return obj
}

// Submit handler
const submitRule = async () => {
  loading.value = true
  errorMessage.value = ''
  success.value = false

  try {
    const condJson = buildConditionsJson()
    const { error } = await supabase.from('subsidy_rules').insert([
      {
        provider_id: userStore.user_id,
        rule_name: ruleName.value,
        conditions: condJson,
        subsidy_amount: subsidyAmount.value,
      },
    ])

    if (error) {
      errorMessage.value = error.message
    } else {
      success.value = true
      store.fetchRules()
    }
  } catch (err: any) {
    errorMessage.value = err.message
  }
  resetForm()
  requested.value = true

  loading.value = false
}

const resetForm = () => {
  ruleName.value = ''
  subsidyAmount.value = null
  conditions.value = []
}
</script>

<template>
  <v-card class="p-6 rounded-2xl shadow-lg max-w-xl mx-auto">
    <v-card-title class="text-xl font-bold mb-4">➕ Add Subsidy Rule</v-card-title>
    <v-card-text>
      <v-form @submit.prevent="submitRule">
        <v-text-field v-model="ruleName" label="Rule Name" required></v-text-field>

        <v-text-field v-model="subsidyAmount" label="Subsidy Amount" type="number"></v-text-field>

        <h3 class="text-lg font-semibold mt-4 mb-2">Conditions</h3>

        <div v-for="(c, index) in conditions" :key="index" class="flex gap-2 items-center mb-2">
          <v-text-field
            v-model="c.key"
            label="Condition Key (e.g. min_income, siblings_count)"
            dense
          ></v-text-field>
          <v-text-field v-model="c.value" label="Value" dense></v-text-field>
          <v-btn icon color="error" @click="removeCondition(index)">
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </div>

        <v-btn color="secondary" @click="addCondition" class="mt-3"> ➕ Add Condition </v-btn>

        <v-btn
          type="submit"
          color="primary"
          class="mt-3 mx-3"
          :loading="loading"
          :disabled="loading"
        >
          Save Rule
        </v-btn>
        <v-alert v-if="errorMessage" type="error" class="mt-2">{{ errorMessage }}</v-alert>
        <v-alert v-if="success" type="success" class="mt-2">Rule added successfully!</v-alert>
      </v-form>
    </v-card-text>
  </v-card>

  <!-- Dialog shown after a request is made -->
  <v-dialog v-model="requested" persistent max-width="500">
    <v-card>
      <v-card-title class="text-lg font-semibold">
        <span v-if="success">Request Completed</span>
        <span v-else>Request Error</span>
      </v-card-title>

      <v-card-text>
        <div v-if="success" class="flex items-center gap-3">
          <v-icon color="success">mdi-check-circle</v-icon>
          <div>Rule added successfully.</div>
        </div>
        <div v-else class="flex items-start gap-3">
          <v-icon color="error">mdi-alert-circle</v-icon>
          <div>
            <div class="font-semibold">There was a problem adding the rule.</div>
            <div v-if="errorMessage" class="text-sm text-gray-600 mt-1">{{ errorMessage }}</div>
          </div>
        </div>
      </v-card-text>

      <v-btn v-if="success" color="primary" @click="router.push('/dashboard')"> OK </v-btn>
    </v-card>
  </v-dialog>
</template>
