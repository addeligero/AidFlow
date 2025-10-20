<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
const AdminLayout = defineAsyncComponent(() => import('../../layouts/AdminLayout.vue'))
const MyRules = defineAsyncComponent(() => import('./MyProgram.vue'))
</script>
<template>
  <AdminLayout>
    <MyRules />
  </AdminLayout>
</template>
