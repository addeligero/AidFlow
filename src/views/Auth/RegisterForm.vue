<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useTheme } from 'vuetify'
import supabase from '@/lib/Supabase'
import Header from '@/components/HeaderSection.vue'

const router = useRouter()
const theme = useTheme()

// Form state
const first_name = ref('')
const last_name = ref('')
const email = ref('')
const password = ref('')
const password_confirmation = ref('')
const showPassword = ref(false)
const showPasswordConfirm = ref(false)

// UX state
const isSubmitting = ref(false)
const showSuccess = ref(false)
const showDialog = ref(false)
const failed = ref(false)
const errorMessage = ref('')

// Simple inline validation
const allFilled = computed(
  () =>
    first_name.value &&
    last_name.value &&
    email.value &&
    password.value &&
    password_confirmation.value,
)
const passwordMatch = computed(
  () => !password.value || password.value === password_confirmation.value,
)
const passwordStrong = computed(() => password.value.length >= 6)
const canSubmit = computed(
  () => allFilled.value && passwordMatch.value && passwordStrong.value && !isSubmitting.value,
)

const passwordRules = [
  (v: string) => !!v || 'Required',
  (v: string) => v.length >= 6 || 'Min 6 characters',
]
const confirmRules = [
  (v: string) => !!v || 'Required',
  (v: string) => v === password.value || 'Passwords must match',
]

const openDialog = (success: boolean, message = '') => {
  showSuccess.value = success
  failed.value = !success
  errorMessage.value = message
  showDialog.value = true
  const timeout = success ? 1500 : 4500
  setTimeout(() => {
    showDialog.value = false
    if (success) router.push('/dashboard')
  }, timeout)
}

const register = async () => {
  if (!canSubmit.value) {
    openDialog(
      false,
      !passwordMatch.value ? 'Passwords do not match.' : 'Fill all required fields.',
    )
    return
  }

  isSubmitting.value = true
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: { data: { full_name: `${first_name.value.trim()} ${last_name.value.trim()}` } },
    })

    if (error) throw new Error(error.message)
    if (!data.user) {
      openDialog(true, 'Check your email to confirm your account.')
      return
    }

    const { error: insertErr } = await supabase.from('users').insert([
      {
        first_name: first_name.value.trim(),
        last_name: last_name.value.trim(),
        email: email.value.trim(),
        user_id: data.user.id,
      },
    ])
    if (insertErr) throw new Error(insertErr.message)

    localStorage.setItem('token', data.session?.access_token || '')
    openDialog(true)
  } catch (e: any) {
    console.error('Registration failed:', e)
    const msg = axios.isAxiosError(e)
      ? e.response?.data?.message || 'Something went wrong.'
      : e?.message || 'Something went wrong.'
    openDialog(false, msg)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="auth-bg d-flex flex-column">
    <Header />
    <v-container class="flex-grow-1 d-flex align-center justify-center py-8">
      <v-row class="justify-center w-100" style="max-width: 920px">
        <v-col cols="12" md="6" class="d-none d-md-flex">
          <v-sheet
            class="pa-8 gradient-panel rounded-lg w-100 d-flex flex-column justify-center"
            elevation="0"
          >
            <h2 class="text-h5 mb-4 font-weight-medium">Join AidFlow</h2>
            <p class="text-body-2 mb-6 text-medium-emphasis">
              Create an account to manage community subsidy rules, collaborate with admins, and
              empower your organization.
            </p>
            <v-icon size="96" color="primary" class="mb-n4" icon="mdi-hand-heart" />
          </v-sheet>
        </v-col>
        <v-col cols="12" md="6">
          <v-card
            elevation="10"
            rounded="xl"
            :class="theme.global.name.value === 'dark' ? 'glass-dark' : 'glass-light'"
          >
            <v-card-text class="pa-8">
              <div class="text-center mb-6">
                <v-avatar size="60" class="mb-3" color="primary" variant="tonal">
                  <v-icon icon="mdi-account-plus" />
                </v-avatar>
                <h1 class="text-h6 mb-1">Create account</h1>
                <p class="text-caption text-medium-emphasis mb-0">
                  Already have one?
                  <router-link to="/" class="text-decoration-none">Login</router-link>
                </p>
              </div>
              <v-form @submit.prevent="register" class="" autocomplete="off">
                <div class="d-flex flex-column flex-md-row ga-4">
                  <v-text-field
                    v-model="first_name"
                    label="First name"
                    prepend-inner-icon="mdi-account"
                    :rules="[(v) => !!v || 'Required']"
                    density="comfortable"
                    variant="outlined"
                    hide-details="auto"
                  />
                  <v-text-field
                    v-model="last_name"
                    label="Last name"
                    prepend-inner-icon="mdi-account"
                    :rules="[(v) => !!v || 'Required']"
                    density="comfortable"
                    variant="outlined"
                    hide-details="auto"
                  />
                </div>
                <v-text-field
                  v-model="email"
                  label="Email"
                  type="email"
                  prepend-inner-icon="mdi-email"
                  :rules="[(v) => !!v || 'Required']"
                  class="mt-4"
                  density="comfortable"
                  variant="outlined"
                  hide-details="auto"
                />
                <v-text-field
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  label="Password"
                  prepend-inner-icon="mdi-lock"
                  :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                  @click:append-inner="showPassword = !showPassword"
                  :rules="passwordRules"
                  class="mt-4"
                  density="comfortable"
                  variant="outlined"
                  hide-details="auto"
                />
                <v-text-field
                  v-model="password_confirmation"
                  :type="showPasswordConfirm ? 'text' : 'password'"
                  label="Confirm password"
                  prepend-inner-icon="mdi-lock-check"
                  :append-inner-icon="showPasswordConfirm ? 'mdi-eye-off' : 'mdi-eye'"
                  @click:append-inner="showPasswordConfirm = !showPasswordConfirm"
                  :rules="confirmRules"
                  class="mt-4"
                  density="comfortable"
                  variant="outlined"
                  hide-details="auto"
                />

                <div class="d-flex flex-wrap mt-3 text-caption text-medium-emphasis ga-4">
                  <div :class="passwordStrong ? 'text-success' : ''">Min 6 chars</div>
                  <div :class="passwordMatch ? 'text-success' : ''">Passwords match</div>
                </div>

                <v-btn
                  :disabled="!canSubmit"
                  :loading="isSubmitting"
                  color="primary"
                  block
                  class="mt-6"
                  size="large"
                  type="submit"
                >
                  Register
                </v-btn>
              </v-form>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Feedback Dialog -->
    <v-dialog v-model="showDialog" max-width="380" persistent>
      <v-card elevation="12" class="rounded-xl">
        <v-card-text class="text-center py-6">
          <v-avatar
            size="60"
            class="mb-3"
            :color="showSuccess ? 'success' : 'error'"
            variant="tonal"
          >
            <v-icon
              size="40"
              :icon="showSuccess ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'"
            />
          </v-avatar>
          <h3 class="mb-1">
            {{ showSuccess ? 'Registration Successful' : 'Registration Failed' }}
          </h3>
          <p class="text-body-2 mb-0" v-if="showSuccess">Redirecting...</p>
          <p class="text-body-2 mb-0" v-else>{{ errorMessage }}</p>
        </v-card-text>
        <v-divider />
        <v-card-actions class="justify-center py-3">
          <v-btn v-if="!showSuccess" variant="flat" color="primary" @click="showDialog = false"
            >Close</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.auth-bg {
  min-height: 100vh;
  background:
    linear-gradient(
      145deg,
      rgba(var(--v-theme-primary), 0.08),
      rgba(var(--v-theme-secondary), 0.08)
    ),
    radial-gradient(circle at 20% 20%, rgba(var(--v-theme-primary), 0.15), transparent 60%),
    radial-gradient(circle at 80% 80%, rgba(var(--v-theme-secondary), 0.18), transparent 55%);
}
.gradient-panel {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.15),
    rgba(var(--v-theme-secondary), 0.15)
  );
  backdrop-filter: blur(4px);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.glass-light {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.05);
}
.glass-dark {
  backdrop-filter: blur(10px);
  background: rgba(30, 30, 32, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
