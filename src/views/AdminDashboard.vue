<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminSidebar from '@/components/Admin/AdminSidebar.vue'

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
  <div>
    <AdminSidebar />
  </div>
</template>

<style scoped></style>
