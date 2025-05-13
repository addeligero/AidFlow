<script setup lang="ts">
import image1 from '@/assets/img/Dashboard/family.jpg'
import image2 from '@/assets/img/Dashboard/doctors.jpg'
import image3 from '@/assets/img/Dashboard/pretty.png'

const images = [image1, image2, image3]
</script>

<template>
  <v-carousel height="400" show-arrows="hover" cycle hide-delimiters>
    <v-carousel-item v-for="(img, i) in images" :key="i">
      <v-img :src="img" height="100%" contain> </v-img>
    </v-carousel-item>
  </v-carousel>
</template>

<style scoped></style>
