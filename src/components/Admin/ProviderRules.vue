<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/users' // assuming you store logged-in provider info
import { providersStore } from '@/stores/providers'
import supabase from '@/lib/Supabase'

const store = providersStore()
const userStore = useUserStore()

// Form state
const ruleName = ref('')
const minIncome = ref<number | null>(null)
const maxIncome = ref<number | null>(null)
const dependents = ref<number | null>(null)
const medicalCondition = ref('')
const barangayClearance = ref(false)
const subsidyAmount = ref<number | null>(null)

// UI
const loading = ref(false)
const success = ref(false)
const errorMessage = ref('')

// Available dropdown values
const medicalOptions = ['Critical', 'Chronic', 'Minor']

// Submit handler
const submitRule = async () => {
  loading.value = true
  errorMessage.value = ''
  success.value = false

  try {
    const conditions = {
      min_income: minIncome.value,
      max_income: maxIncome.value,
      dependents: dependents.value,
      medical_condition: medicalCondition.value,
      barangay_clearance_required: barangayClearance.value,
    }

    const { error } = await supabase.from('subsidy_rules').insert([
      {
        provider_id: userStore.user.id, // logged-in provider id
        rule_name: ruleName.value,
        conditions,
        subsidy_amount: subsidyAmount.value,
      },
    ])

    if (error) {
      errorMessage.value = error.message
    } else {
      success.value = true
      store.fetchRules() // refresh rules list
      resetForm()
    }
  } catch (err: any) {
    errorMessage.value = err.message
  }

  loading.value = false
}

const resetForm = () => {
  ruleName.value = ''
  minIncome.value = null
  maxIncome.value = null
  dependents.value = null
  medicalCondition.value = ''
  barangayClearance.value = false
  subsidyAmount.value = null
}
</script>

<template>
  <v-card class="p-6 rounded-2xl shadow-lg max-w-xl mx-auto">
    <v-card-title class="text-xl font-bold mb-4">➕ Add Subsidy Rule</v-card-title>
    <v-card-text>
      <v-form @submit.prevent="submitRule">
        <v-text-field v-model="ruleName" label="Rule Name" required></v-text-field>

        <v-row>
          <v-col cols="6">
            <v-text-field v-model="minIncome" label="Min Income" type="number"></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="maxIncome" label="Max Income" type="number"></v-text-field>
          </v-col>
        </v-row>

        <v-text-field v-model="dependents" label="Minimum Dependents" type="number"></v-text-field>

        <v-select
          v-model="medicalCondition"
          :items="medicalOptions"
          label="Medical Condition"
          clearable
        ></v-select>

        <v-switch v-model="barangayClearance" label="Barangay Clearance Required"></v-switch>

        <v-text-field v-model="subsidyAmount" label="Subsidy Amount" type="number"></v-text-field>

        <v-alert v-if="errorMessage" type="error" class="mt-2">{{ errorMessage }}</v-alert>
        <v-alert v-if="success" type="success" class="mt-2">Rule added successfully!</v-alert>

        <v-btn
          type="submit"
          color="primary"
          class="mt-4 w-full"
          :loading="loading"
          :disabled="loading"
        >
          Save Rule
        </v-btn>
      </v-form>
    </v-card-text>
  </v-card>
</template>
