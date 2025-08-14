<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Sidebar from '@/components/Client dashboard/SidebarContainer.vue'
import Header from '@/components/HeaderSection.vue'
import { useUserStore } from '@/stores/users'
import { useTheme } from 'vuetify'

const theme = useTheme()
const drawer = ref(false)
const toggleDrawer = () => {
  drawer.value = !drawer.value
}

const userStore = useUserStore()

onMounted(async () => {
  if (!userStore.isUserLoaded) {
    console.log('Fetching user data...')
    await userStore.fetchUser()
  }

  console.log('laktaw')
})
</script>

<template>
  <Sidebar v-model="drawer" />

  <Header :toggleDrawer="toggleDrawer" />

  <div
    class="main-content"
    :class="theme.global.name.value === 'dark' ? 'bg-black' : 'bg-grey-lighten-1'"
    style="min-height: 100vh"
  >
    <v-container fluid>
      <slot />
      <!-- 👈 Slot for injecting page-specific content -->
    </v-container>
  </div>
</template>

<style scoped>
.main-content {
  margin-top: 20px;
}
</style>
