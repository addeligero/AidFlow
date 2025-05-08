<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useTheme } from 'vuetify' // Import useTheme

const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const password_confirmation = ref('')
const isSubmitting = ref(false)

const theme = useTheme() // Get current theme

const register = async () => {
  isSubmitting.value = true

  try {
    const response = await axios.post('http://127.0.0.1:8000/api/register', {
      name: name.value,
      email: email.value,
      password: password.value,
      password_confirmation: password_confirmation.value,
    })

    if (!response.data.access_token) {
      throw new Error('Registration failed')
    }

    localStorage.setItem('token', response.data.access_token)
    alert('Registration successful!')
    router.push('/home')
  } catch (error) {
    console.error('Registration failed:', error)
    alert(error.response?.data?.message || 'Something went wrong.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <v-container height="100vh" class="d-flex align-center justify-center mx-auto">
    <v-sheet
      width="400"
      elevation="8"
      rounded
      :color="theme.global.name.value === 'light' ? 'white' : 'grey-darken-3'"
      :dark="theme.global.name.value === 'dark'"
    >
      <h3
        class="text-center py-4"
        :class="theme.global.name.value === 'light' ? 'text-dark' : 'text-white'"
      >
        Register
      </h3>
      <v-form @submit.prevent="register" class="pa-4">
        <v-text-field
          v-model="name"
          label="Name"
          required
          :outlined="true"
          :color="theme.global.name.value === 'light' ? 'primary' : 'secondary'"
        ></v-text-field>

        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          required
          :outlined="true"
          :color="theme.global.name.value === 'light' ? 'primary' : 'secondary'"
        ></v-text-field>

        <v-text-field
          v-model="password"
          label="Password"
          type="password"
          required
          :outlined="true"
          :color="theme.global.name.value === 'light' ? 'primary' : 'secondary'"
        ></v-text-field>

        <v-text-field
          v-model="password_confirmation"
          label="Confirm Password"
          type="password"
          required
          :outlined="true"
          :color="theme.global.name.value === 'light' ? 'primary' : 'secondary'"
        ></v-text-field>

        <v-btn
          :loading="isSubmitting"
          type="submit"
          :color="theme.global.name.value === 'light' ? 'primary' : 'secondary'"
          block
          class="mt-4"
        >
          Register
        </v-btn>

        <router-link to="/" class="text-decoration-none">
          <v-btn
            :loading="isSubmitting"
            type="button"
            block
            :color="theme.global.name.value === 'light' ? 'cyan' : 'cyan-darken-4'"
            class="mt-4"
          >
            Login
          </v-btn>
        </router-link>
      </v-form>
    </v-sheet>
  </v-container>
</template>
