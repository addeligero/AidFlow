<script setup lang="ts">
import AdminLayout from '@/layouts/AdminLayout.vue'
import AdminCard from '@/components/Admin/AdminCard.vue'
import DashboardChart from '@/views/admin/DashboardChart.vue'
</script>
<template>
  <AdminLayout>
    <DashboardChart />
    <AdminCard
      title="Rules"
      subHeader="Empower Your Community"
      shortStatement="Click below to add or update your community guidelines."
      buttonText="View Rules Here"
    />
  </AdminLayout>
</template>
