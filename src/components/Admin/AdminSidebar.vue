<script setup lang="ts">
import AdminCard from './AdminCard.vue'
</script>
<template>
  <v-card style="height: 100vh">
    <v-layout style="height: 100%">
      <v-navigation-drawer expand-on-hover rail height="100%">
        <v-list>
          <v-list-item
            prepend-avatar="https://randomuser.me/api/portraits/women/85.jpg"
            subtitle="sandra_a88@gmailcom"
            title="Sandra Adams"
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

      <v-main style="height: 100%">
        <AdminCard />
      </v-main>
    </v-layout>
  </v-card>
</template>
