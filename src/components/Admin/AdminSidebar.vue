<script setup lang="ts">
import { useTheme, useDisplay } from 'vuetify'
import { ref } from 'vue'
import AdminCard from './AdminCard.vue'
import { userCounterStore } from '@/stores/users'

const user = userCounterStore()

const drawer = ref(true)
const { mdAndDown } = useDisplay()
// Theme toggle
const theme = useTheme()
const savedTheme = localStorage.getItem('theme')

if (savedTheme) {
  theme.global.name.value = savedTheme
}

function onClick() {
  const newTheme = theme.global.name.value === 'light' ? 'dark' : 'light'
  theme.global.name.value = newTheme
  localStorage.setItem('theme', newTheme)
}
</script>
<template>
  <v-card style="height: 100vh">
    <v-layout style="height: 100%">
      <v-app-bar flat>
        <!-- Show hamburger only on md and down -->
        <v-app-bar-nav-icon v-if="mdAndDown" @click="drawer = !drawer" />
        <v-toolbar-title>Admin</v-toolbar-title>

        <v-btn
          :prepend-icon="
            theme.global.name.value === 'light' ? 'mdi-weather-sunny' : 'mdi-weather-night'
          "
          :text="theme.global.name.value === 'light' ? 'Light' : 'Dark'"
          slim
          @click="onClick"
        ></v-btn>
      </v-app-bar>

      <v-navigation-drawer v-model="drawer" expand-on-hover height="100%" app>
        <hr />
        <v-list>
          <v-list-item
            prepend-avatar="https://randomuser.me/api/portraits/women/85.jpg"
            subtitle="sandra_a88@gmailcom"
            :title="user.userFullName"
          ></v-list-item>
        </v-list>

        <v-divider></v-divider>

        <v-list density="compact" nav>
          <v-list-item prepend-icon="mdi-folder" title="My Files" value="myfiles"></v-list-item>
          <v-list-item
            prepend-icon="mdi-account-multiple"
            title="Shared with me"
            value="shared"
          ></v-list-item>
          <v-list-item prepend-icon="mdi-star" title="Starred" value="starred"></v-list-item>
        </v-list>
      </v-navigation-drawer>

      <v-main
        style="height: 100%"
        :class="theme.global.name.value === 'dark' ? 'bg-black' : 'bg-grey-lighten-1'"
      >
        <hr />

        <AdminCard />
      </v-main>
    </v-layout>
  </v-card>
</template>
