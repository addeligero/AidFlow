<template>
  <ClientLayout>
    <v-row justify="center">
      <v-col cols="12">
        <br />
        <Carousel />
      </v-col>
      <v-col cols="12">
        <hr />
        <br />
        <h3>Services</h3>

        <IconSection title="Service 1" subtitle="Description for Service 1" />
        <br />
        <IconSection title="Service 2" subtitle="Description for Service 2" />
      </v-col>
    </v-row>
  </ClientLayout>
</template>

<script setup lang="ts">
import ClientLayout from '@/layouts/ClientLayout.vue'
import Carousel from '@/components/Client dashboard/CarouselSection.vue'
import IconSection from '@/components/Client dashboard/IconSection.vue'
</script>
