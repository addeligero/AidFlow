<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Sidebar from '@/components/Client dashboard/SidebarContainer.vue'
import Header from '@/components/HeaderSection.vue'
import AdminCard from '@/components/Admin/AdminCard.vue'

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
    <AdminCard />
  </div>
</template>

<style scoped>
.main-content {
  margin-top: 50px;
}

.content-wrapper {
  background-color: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}
</style>
