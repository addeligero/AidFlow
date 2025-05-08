<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const email = ref('')
const password = ref('')
const isSubmitting = ref(false)

const login = async () => {
  isSubmitting.value = true

  try {
    const response = await axios.post('http://127.0.0.1:8000/api/login', {
      email: email.value,
      password: password.value,
    })

    if (!response.data.access_token) {
      throw new Error('Invalid credentials')
    }

    localStorage.setItem('token', response.data.access_token)
    alert('Login successful!')
    router.push('/dashboard')
  } catch (error) {
    if (axios.isAxiosError(error)) {
      alert(error.response?.data?.message || 'Invalid login credentials.')
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
