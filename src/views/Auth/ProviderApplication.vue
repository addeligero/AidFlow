<script setup lang="ts">
import ClientLayout from '@/layouts/ClientLayout.vue'
import { ref, reactive } from 'vue'
import supabase from '@/lib/Supabase'
import { useUserStore } from '@/stores/users'

const store = useUserStore()
type VFormRef = {
  validate: () => Promise<{ valid: boolean }>
  reset: () => void
  resetValidation: () => void
}
const formRef = ref<VFormRef | null>(null)

const form = reactive({
  agencyName: '',
  officeAddress: '',
  contactPerson: '',
  agencyEmail: '',
  agencyNumber: '',
})

const valid = ref(false)
const loading = ref(false)
const successDialog = ref(false)
const errorMsg = ref<string | null>(null)

const rules = {
  required: (v: string | null | undefined) => !!v || 'Required',
  email: (v: string | null | undefined) => /.+@.+\..+/.test(v || '') || 'Invalid email',
}

async function submitForm() {
  errorMsg.value = null

  const validation = await formRef.value?.validate()
  if (!validation?.valid) return

  loading.value = true
  try {
    const payload = {
      agency_name: form.agencyName.trim(),
      office_address: form.officeAddress.trim(),
      contact_person: form.contactPerson.trim(),
      agency_email: form.agencyEmail.trim().toLowerCase(),
      agency_num: form.agencyNumber.trim(),
      id: store.user_id,
    }

    const { error } = await supabase.from('providers').insert([payload])

    if (error) throw error

    Object.keys(form).forEach((k) => (form[k as keyof typeof form] = ''))
    successDialog.value = true
  } catch (e: any) {
    console.error(e)
    errorMsg.value = e.message || 'Submission failed.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <ClientLayout>
    <v-container class="py-12">
      <v-row justify="center" class="mb-10">
        <v-col cols="12" md="9" class="text-center">
          <v-chip color="primary" size="small" variant="flat" class="mb-4">
            Become a Partner
          </v-chip>
          <div class="text-h4 text-md-h3 font-weight-bold mb-3">
            Ready to become a <span class="text-primary">Subsidy Provider</span>?
          </div>
          <div class="text-body-1 text-medium-emphasis mx-auto" style="max-width: 600px">
            Join AidFlow’s network to distribute resources efficiently, reach more beneficiaries,
            and streamline reporting in real time.
          </div>
        </v-col>
      </v-row>

      <v-row justify="center" align="stretch" class="g-6">
        <v-col cols="12" md="5">
          <v-card rounded="xl" elevation="6" class="pa-6">
            <div class="text-h6 font-weight-medium mb-4">Why partner with us?</div>
            <v-list density="comfortable" class="benefits-list">
              <v-list-item
                v-for="(b, i) in [
                  'Faster beneficiary verification',
                  'Secure document handling',
                  'Transparency dashboard',
                  'Automated compliance summaries',
                  'Scalable distribution tracking',
                ]"
                :key="i"
                prepend-icon="mdi-check-circle"
                class="benefit-item"
              >
                <template #title>
                  <span class="benefit-text">{{ b }}</span>
                </template>
              </v-list-item>
            </v-list>
            <v-divider class="my-5"></v-divider>
            <div class="d-flex align-center">
              <v-icon color="primary" class="me-2">mdi-shield-check</v-icon>
              <span class="text-body-2 text-medium-emphasis">
                Reviewed within 3–5 business days.
              </span>
            </div>
          </v-card>
        </v-col>

        <v-col cols="12" md="7">
          <v-card rounded="xl" elevation="8" class="pa-6">
            <div class="d-flex align-center mb-4">
              <v-avatar size="46" class="me-3" color="primary" variant="tonal">
                <v-icon color="primary">mdi-domain</v-icon>
              </v-avatar>
              <div>
                <div class="text-h6 font-weight-bold">Application Form</div>
                <div class="text-caption text-medium-emphasis">
                  Provide accurate organizational details.
                </div>
              </div>
            </div>

            <v-form ref="formRef" v-model="valid" @submit.prevent="submitForm">
              <v-text-field
                v-model="form.agencyName"
                label="Agency Name"
                :rules="[rules.required]"
                prepend-inner-icon="mdi-domain"
                variant="outlined"
                density="comfortable"
                class="mb-3"
              />
              <v-text-field
                v-model="form.officeAddress"
                label="Office Address"
                :rules="[rules.required]"
                prepend-inner-icon="mdi-map-marker"
                variant="outlined"
                density="comfortable"
                class="mb-3"
              />
              <v-text-field
                v-model="form.contactPerson"
                label="Contact Person"
                :rules="[rules.required]"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                density="comfortable"
                class="mb-3"
              />
              <v-text-field
                v-model="form.agencyEmail"
                label="Agency Email"
                :rules="[rules.required, rules.email]"
                prepend-inner-icon="mdi-email"
                type="email"
                variant="outlined"
                density="comfortable"
                class="mb-3"
              />
              <v-text-field
                v-model="form.agencyNumber"
                label="Agency Contact Number"
                :rules="[rules.required]"
                prepend-inner-icon="mdi-phone"
                type="tel"
                variant="outlined"
                density="comfortable"
                class="mb-4"
              />

              <div class="text-caption text-medium-emphasis mb-4">
                Submitting confirms accuracy of the provided information.
              </div>

              <v-btn
                type="submit"
                color="primary"
                block
                size="large"
                :disabled="!valid || loading"
                :loading="loading"
              >
                Submit Application
              </v-btn>
              <v-alert
                v-if="errorMsg"
                type="error"
                variant="tonal"
                density="compact"
                class="mb-4"
                :text="errorMsg"
                closable
                @click:close="errorMsg = null"
              />
            </v-form>
          </v-card>
        </v-col>
      </v-row>

      <v-dialog v-model="successDialog" max-width="420">
        <v-card rounded="xl" elevation="10">
          <v-card-title class="d-flex align-center">
            <v-icon color="primary" class="me-2">mdi-check-decagram</v-icon>
            Application Submitted
          </v-card-title>
          <v-card-text>
            Thank you. Your application is under review. We will email you updates.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" variant="flat" @click="successDialog = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </ClientLayout>
</template>
<style scoped>
.benefit-item .v-list-item-title,
.benefit-text {
  white-space: normal;
  overflow: visible;
  text-overflow: initial;
}
</style>
