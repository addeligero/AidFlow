<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import supabase from '@/lib/Supabase'

const router = useRouter()

const email = ref('')
const password = ref('')
const isSubmitting = ref(false)
const showSuccess = ref(false)
const showDialog = ref(false)
const loginFailed = ref(false)
const errorMessage = ref('')

const login = async () => {
  if (!email.value || !password.value) {
    alert('Please fill in all fields.')
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    alert('Please enter a valid email address.')
    return
  }

  isSubmitting.value = true

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (error) {
      throw new Error(error.message)
    }

    if (data.session) {
      const { session, user } = data
      sessionStorage.setItem('access_token', session.access_token)
      sessionStorage.setItem('refresh_token', session.refresh_token)
      sessionStorage.setItem('auth_id', user.id)

      showSuccess.value = true
      loginFailed.value = false
      showDialog.value = true
      setTimeout(() => {
        showDialog.value = false
        router.push('/dashboard')
      }, 1500)
    }
  } catch (error) {
    showSuccess.value = false
    loginFailed.value = true
    showDialog.value = true
    setTimeout(() => {
      showDialog.value = false
    }, 5000)
    if (error instanceof Error) {
      errorMessage.value = error.message
    } else {
      alert('An unexpected error occurred.')
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="login-bg d-flex align-center justify-center min-h-screen">
    <v-sheet class="mx-auto py-8 px-6 rounded-xl login-sheet" width="370" elevation="12">
      <div class="text-center mb-6">
        <v-avatar size="56" class="mb-2" color="primary">
          <v-icon size="36" color="white">mdi-account-circle</v-icon>
        </v-avatar>
        <h2 class="font-weight-bold mb-1">Welcome Back</h2>
        <p class="text-grey-darken-1">Sign in to your account</p>
      </div>
      <v-form fast-fail @submit.prevent="login">
        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-email-outline"
          class="mb-3"
          required
        ></v-text-field>

        <v-text-field
          v-model="password"
          label="Password"
          type="password"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-lock-outline"
          class="mb-4"
          required
        ></v-text-field>

        <v-btn
          :loading="isSubmitting"
          class="mb-3"
          type="submit"
          block
          color="primary"
          size="large"
          elevation="2"
        >
          Sign In
        </v-btn>
        <div class="text-center">
          <span class="text-grey-darken-1">Don't have an account?</span>
          <a href="/register" class="text-primary font-weight-medium ml-1">Register</a>
        </div>
      </v-form>
    </v-sheet>

    <!-- Dialog for login result -->
    <v-dialog v-model="showDialog" max-width="360" persistent>
      <v-card :color="showSuccess ? 'success' : 'error'" elevation="12" class="rounded-xl">
        <v-card-text class="text-center py-6">
          <v-avatar size="56" class="mb-3" :color="showSuccess ? 'white' : 'white'">
            <v-icon size="40" :color="showSuccess ? 'success' : 'error'">
              {{ showSuccess ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline' }}
            </v-icon>
          </v-avatar>
          <div>
            <h3 class="mb-1" :class="showSuccess ? 'text-success' : 'text-error'">
              {{ showSuccess ? 'Login Successful!' : 'Login Failed' }}
            </h3>
            <p class="text-body-1" v-if="showSuccess">Redirecting to your dashboard...</p>
            <p class="text-body-2" v-else>{{ errorMessage }}</p>
          </div>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions class="justify-center py-3">
          <v-btn
            v-if="!showSuccess"
            color="primary"
            variant="flat"
            @click="showDialog = false"
            rounded
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
