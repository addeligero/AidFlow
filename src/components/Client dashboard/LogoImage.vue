<script setup lang="ts">
defineProps<{
  loc: string
}>()
</script>

<template>
  <v-img :width="50" aspect-ratio="16/9" cover :src="loc" />
</template>
