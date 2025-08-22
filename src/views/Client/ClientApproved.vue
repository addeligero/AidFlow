<template>
  <v-container class="approved-container" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card elevation="2" class="pa-6 text-center">
          <v-card-title class="justify-center">
            <v-icon size="36" color="success">mdi-check-circle</v-icon>
            <span class="title ms-2">Congratulations!</span>
          </v-card-title>

          <v-card-text>
            <div>Your provider application has been approved.</div>
            <div class="mt-2">You can now access the admin dashboard.</div>
          </v-card-text>

          <v-card-actions class="justify-center">
            <v-btn color="primary" dark @click="goToAdmin">Go to Admin Dashboard</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
const goToAdmin = () => router.push('/admin')
</script>

<style scoped>
.approved-container {
  margin-top: 64px;
}
.title {
  font-weight: 600;
}
</style>
