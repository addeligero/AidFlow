<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Sidebar from '@/components/Client dashboard/SidebarContainer.vue'
import Header from '@/components/HeaderSection.vue'
import Carousel from '@/components/Client dashboard/CarouselSection.vue'
import IconSection from '@/components/Client dashboard/IconSection.vue'
import { userCounterStore } from '@/stores/users'
import { useTheme } from 'vuetify'

const theme = useTheme()

const drawer = ref(false)
const toggleDrawer = () => {
  drawer.value = !drawer.value
}

const userStore = userCounterStore()

onMounted(async () => {
  await userStore.fetchUsers()
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
      <v-row justify="center">
        <v-col cols="12" md="6">
          <Carousel />
        </v-col>

        <v-col cols="12" md="6">
          <h3
            class="text-center text-3xl font-bold italic text-indigo-700 my-8 tracking-wide shadow-lg bg-gradient-to-r from-white via-gray-100 to-white bg-opacity-80 px-8 py-4 rounded-xl border border-indigo-200 animate-fade-in"
          >
            <i>Bringing Clarity and Speed to Public Assistance</i>
          </h3>
          <IconSection />
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped>
.main-content {
  margin-top: 20px;
}

.content-wrapper {
  background-color: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}
</style>
