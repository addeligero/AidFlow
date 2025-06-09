<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Sidebar from '@/components/dashboard/SidebarContainer.vue'
import Header from '@/components/HeaderSection.vue'
import Carousel from '@/components/dashboard/CarouselSection.vue'
import IconSection from '@/components/dashboard/IconSection.vue'
import { userCounterStore } from '@/stores/users'

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

  <div class="main-content">
    <h3
      class="text-center text-3xl font-bold italic text-indigo-700 my-8 tracking-wide shadow-lg bg-gradient-to-r from-white via-gray-100 to-white bg-opacity-80 px-8 py-4 rounded-xl border border-indigo-200 animate-fade-in"
    >
      <i>Bringing Clarity and Speed to Public Assistance</i>
    </h3>

    <v-container fluid>
      <v-row justify="center">
        <!-- Carousel on the left (md=6 = 50%) -->
        <v-col cols="12" md="6">
          <Carousel />
        </v-col>

        <!-- IconSection on the right (md=6 = 50%) -->
        <v-col cols="12" md="6">
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
