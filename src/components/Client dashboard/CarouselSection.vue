<script setup lang="ts">
import Philhealth from '@/assets/img/logo/philhealth.jpg'
import DOH from '@/assets/img/logo/doh.png'
import DSWD from '@/assets/img/logo/DSWD.SVG.png'
import MALASAKIT from '@/assets/img/logo/malasakit.jpg'
import LogoImage from '@/components/Client dashboard/LogoImage.vue'
import pcso from '@/assets/img/logo/pcso.jpg'

const images = [Philhealth, DOH, DSWD, MALASAKIT, pcso]
</script>

<template>
  <v-sheet class="mx-auto" elevation="8" max-width="800">
    <v-slide-group v-model="model" class="pa-4" selected-class="bg-success" show-arrows>
      <v-slide-group-item
        v-for="(img, i) in images"
        :key="i"
        v-slot="{ isSelected, toggle, selectedClass }"
      >
        <v-card
          :class="['ma-4', selectedClass]"
          color="grey-lighten-1"
          height="90"
          width="150"
          @click="toggle"
        >
          <div class="d-flex fill-height align-center justify-center">
            <v-scale-transition>
              <v-img :src="img"></v-img>
            </v-scale-transition>
          </div>
        </v-card>
      </v-slide-group-item>
    </v-slide-group>
  </v-sheet>
</template>
