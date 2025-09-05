<script setup lang="ts">
defineProps<{
  totalNumber: number
  caption: string
}>()
</script>

<template>
  <v-card color="primary" variant="tonal" class="pa-4">
    <div class="text-h5 font-weight-bold">{{ totalNumber }}</div>
    <div class="text-caption">{{ caption }}</div>
  </v-card>
</template>
