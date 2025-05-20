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

      // Storing tokens in sessionStorage (more secure than localStorage)
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
  <v-sheet class="mx-auto py-4 rounded-lg" width="300">
    <h3 class="text-center">Login</h3>
    <v-form fast-fail @submit.prevent="login">
      <v-text-field v-model="email" label="Email" type="email" required></v-text-field>

      <v-text-field v-model="password" label="Password" type="password" required></v-text-field>

      <v-btn :loading="isSubmitting" class="mt-2" type="submit" block> Submit </v-btn>
      <p class="pt-2">Don't have account? <a href="/register">click here</a></p>
    </v-form>
  </v-sheet>
</template>
