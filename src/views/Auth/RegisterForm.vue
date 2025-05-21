<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useTheme } from 'vuetify' // Import useTheme
import supabase from '@/lib/Supabase'
import Header from '@/components/HeaderSection.vue'

const router = useRouter()

const first_name = ref('')
const last_name = ref('')
const email = ref('')
const password = ref('')
const password_confirmation = ref('')
const isSubmitting = ref(false)

const theme = useTheme() // Get current theme

const register = async () => {
  if (
    !first_name.value ||
    !last_name.value ||
    !email.value ||
    !password.value ||
    !password_confirmation.value
  ) {
    alert('Please fill in all fields.')
    return
  }
  if (password.value !== password_confirmation.value) {
    alert('Passwords do not match.')
    return
  }
  isSubmitting.value = true

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          full_name: `${first_name.value} ${last_name.value}`,
        },
      },
    })

    if (error) {
      throw new Error(error.message)
    }
    if (!data.user) {
      alert('Check your email to confirm your account before proceeding.')
      return
    }

    if (error) {
      throw new Error('registration failed')
    }
    const userData = {
      first_name: first_name.value,
      last_name: last_name.value,
      email: email.value,
      user_id: data.user.id,
    }
    const { data: insertedData, error: insetedError } = await supabase
      .from('users')
      .insert([userData])

    if (insetedError) {
      throw new Error(insetedError.message)
    }

    localStorage.setItem('token', data.session?.access_token || '')
    alert('Registration successful!')
    router.push('/dashboard')
  } catch (error) {
    console.error('Registration failed:', error)
    if (axios.isAxiosError(error)) {
      alert(error.response?.data?.message || 'Something went wrong.')
    } else if (error instanceof Error) {
      alert(error.message)
    } else {
      alert('Something went wrong.')
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Header />
  <v-container height="100vh" class="d-flex align-center justify-center mt-5">
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
          v-model="first_name"
          label="First name"
          required
          :outlined="true"
          :color="theme.global.name.value === 'light' ? 'primary' : 'secondary'"
        ></v-text-field>
        <v-text-field
          v-model="last_name"
          label="Last name"
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
