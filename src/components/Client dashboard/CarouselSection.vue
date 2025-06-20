<script setup lang="ts">
import image1 from '@/assets/img/Client dashboard/heart.jpg'
import image2 from '@/assets/img/Client dashboard/doctors.jpg'
import image3 from '@/assets/img/Client dashboard/pretty.png'

const images = [image1, image2, image3]
</script>

<template>
  <v-carousel class="fill-height" show-arrows="hover" cycle hide-delimiters>
    <v-carousel-item v-for="(img, i) in images" :key="i">
      <v-img :src="img" contain> </v-img>
    </v-carousel-item>
  </v-carousel>
</template>

<style scoped></style>
