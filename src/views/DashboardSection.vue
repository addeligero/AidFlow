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
      class="text-center text-2xl font-semibold italic text-gray-700 my-6 tracking-wide shadow-sm bg-white bg-opacity-80 px-6 py-3 rounded-lg"
    >
      Bringing Clarity and Speed to Public Assistance
    </h3>
    <div class="">
      <Carousel />

      <IconSection />
    </div>
  </div>
</template>

<style scoped>
.main-content {
  margin-top: 20px;
}

.main-content {
  margin-top: -10px;
}

.content-wrapper {
  background-color: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}
</style>
