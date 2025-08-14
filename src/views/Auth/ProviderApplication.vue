<script setup>
import ClientLayout from '@/layouts/ClientLayout.vue'
import { ref, reactive } from 'vue'

const officeAddresses = [
  { address: '123 Main St, City Center' },
  { address: '456 Elm Ave, Uptown' },
  { address: '789 Oak Blvd, Downtown' },
  { address: '101 Maple Rd, Suburbia' },
]

const form = reactive({
  agencyName: '',
  officeAddress: '',
  contactPerson: '',
  agencyEmail: '',
  agencyNumber: '',
})

const valid = ref(false)
const formRef = ref(null)

const rules = {
  required: (v) => !!v || 'This field is required',
  email: (v) => /.+@.+\..+/.test(v) || 'E-mail must be valid',
}

function submitForm() {
  if (formRef.value?.validate()) {
    alert('Application submitted!')
  }
}
</script>

<template>
  <ClientLayout>
    <v-container class="d-flex justify-center align-center" style="min-height: 100vh">
      <v-card max-width="500" class="pa-6" elevation="10">
        <v-card-title class="justify-center text-h5 font-weight-bold">
          Agency Application Form
        </v-card-title>

        <v-card-text>
          <!-- Show loading state until user data is fetched -->

          <v-form @submit.prevent="submitForm" ref="formRef" v-model="valid">
            <v-text-field
              v-model="form.agencyName"
              label="Agency Name"
              :rules="[rules.required]"
              prepend-inner-icon="mdi-domain"
            />
            <v-select
              v-model="form.officeAddress"
              :items="officeAddresses"
              label="Office Address"
              :rules="[rules.required]"
              prepend-inner-icon="mdi-map-marker"
              item-title="address"
              item-value="address"
            />
            <v-text-field
              v-model="form.contactPerson"
              label="Contact Person"
              :rules="[rules.required]"
              prepend-inner-icon="mdi-account"
            />
            <v-text-field
              v-model="form.agencyEmail"
              label="Agency Email"
              :rules="[rules.required, rules.email]"
              prepend-inner-icon="mdi-email"
              type="email"
            />
            <v-text-field
              v-model="form.agencyNumber"
              label="Agency Number"
              :rules="[rules.required]"
              prepend-inner-icon="mdi-phone"
              type="tel"
            />
            <v-btn type="submit" color="primary" class="mt-4" block :disabled="!valid">
              Submit Application
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-container>
  </ClientLayout>
</template>
