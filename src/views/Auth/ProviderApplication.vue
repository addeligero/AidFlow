<script setup>
import ClientLayout from '@/layouts/ClientLayout.vue'
import { ref, reactive } from 'vue'

const form = reactive({
  agencyName: '',
  officeAddress: '',
  contactPerson: '',
  agencyEmail: '',
  agencyNumber: '',
})

const valid = ref(false)
const formRef = ref(null)
const loading = ref(false)

const rules = {
  required: (v) => !!v || 'This field is required',
  email: (v) => /.+@.+\..+/.test(v) || 'E-mail must be valid',
}

async function submitForm() {
  if (formRef.value?.validate()) {
    loading.value = true
    const { error } = await supabase.from('agency_applications').insert([
      {
        agency_name: form.agencyName,
        office_address: form.officeAddress,
        contact_person: form.contactPerson,
        agency_email: form.agencyEmail,
        agency_number: form.agencyNumber,
        status: 'pending',
      },
    ])

    loading.value = false

    if (error) {
      console.error(error)
      alert('Error submitting application. Please try again.')
    } else {
      alert('Application submitted! Awaiting admin approval.')
      Object.keys(form).forEach((key) => (form[key] = '')) // Reset form
    }
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
          <v-form @submit.prevent="submitForm" ref="formRef" v-model="valid">
            <v-text-field
              v-model="form.agencyName"
              label="Agency Name"
              :rules="[rules.required]"
              prepend-inner-icon="mdi-domain"
            />

            <v-text-field
              v-model="form.officeAddress"
              label="Office Address"
              :rules="[rules.required]"
              prepend-inner-icon="mdi-map-marker"
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
              label="Agency Contact Number"
              :rules="[rules.required]"
              prepend-inner-icon="mdi-phone"
              type="tel"
            />

            <v-btn
              type="submit"
              color="primary"
              class="mt-4"
              block
              :disabled="!valid || loading"
              :loading="loading"
            >
              Submit Application
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-container>
  </ClientLayout>
</template>
