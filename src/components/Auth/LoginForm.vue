<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import supabase from '@/lib/Supabase'

const router = useRouter()

const email = ref('')
const password = ref('')
const isSubmitting = ref(false)

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

      alert('Login successful!')
      router.push('/dashboard')
    }
  } catch (error) {
    if (error instanceof Error) {
      alert(error.message || 'Invalid login credentials.')
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
  </div>
</template>

<style scoped>
.login-bg {
  min-height: 100vh;
}
.login-sheet {
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.12);
  border: 1px solid #e3e8ee;
}
</style>
