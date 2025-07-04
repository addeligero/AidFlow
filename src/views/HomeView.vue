<script setup lang="ts">
import Login from '@/components/Auth/LoginForm.vue'
import Header from '@/components/HeaderSection.vue'
import img from '@/assets/img/1.png'
</script>
<template>
  <v-app>
    <v-main>
      <Header />
      <v-container fluid>
        <v-row class="w-100" align="center" justify="center">
          <v-col cols="12" md="6" class="d-flex justify-center align-center">
            <img :src="img" style="max-width: 100%; height: auto" />
          </v-col>
          <v-col cols="12" md="6" class="d-flex justify-center align-center">
            <Login />
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>
