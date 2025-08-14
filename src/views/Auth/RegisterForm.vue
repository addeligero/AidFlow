<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useTheme } from 'vuetify'

import supabase from '@/lib/Supabase'
import Header from '@/components/HeaderSection.vue'

const router = useRouter()

const first_name = ref('')
const last_name = ref('')
const email = ref('')
const password = ref('')
const password_confirmation = ref('')
const isSubmitting = ref(false)
const showSuccess = ref(false)
const showDialog = ref(false)
const loginFailed = ref(false)
const errorMessage = ref('')

const theme = useTheme() // Get current theme

const register = async () => {
  if (
    !first_name.value ||
    !last_name.value ||
    !email.value ||
    !password.value ||
    !password_confirmation.value
  ) {
    errorMessage.value = 'Please fill in all fields.'
    showSuccess.value = false
    loginFailed.value = true
    showDialog.value = true
    setTimeout(() => {
      showDialog.value = false
    }, 5000)
    return
  }
  if (password.value !== password_confirmation.value) {
    errorMessage.value = 'Passwords do not match.'
    showSuccess.value = false
    loginFailed.value = true
    showDialog.value = true
    setTimeout(() => {
      showDialog.value = false
    }, 5000)
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
    showSuccess.value = true
    loginFailed.value = false
    showDialog.value = true
    setTimeout(() => {
      showDialog.value = false
      router.push('/dashboard')
    }, 1500)
    router.push('/dashboard')
  } catch (error) {
    showSuccess.value = false
    loginFailed.value = true
    showDialog.value = true
    setTimeout(() => {
      showDialog.value = false
    }, 5000)
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
  </v-container>
</template>
