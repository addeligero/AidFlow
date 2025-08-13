<script setup lang="ts">
import { ref } from 'vue'

import Philhealth from '@/assets/img/logo/philhealth.jpg'
import DOH from '@/assets/img/logo/doh.png'
import DSWD from '@/assets/img/logo/DSWD.SVG.png'
import MALASAKIT from '@/assets/img/logo/malasakit.jpg'
import pcso from '@/assets/img/logo/pcso.jpg'

const model = ref(null)
const images = [Philhealth, DOH, DSWD, MALASAKIT, pcso]
</script>

<template>
  <v-sheet class="mx-auto" max-width="800" color="transparent">
    <v-slide-group v-model="model" selected-class="bg-success">
      <v-slide-group-item v-for="(img, i) in images" :key="i" v-slot="{ toggle, selectedClass }">
        <v-card :class="['ma-4', selectedClass]" height="150" width="250" @click="toggle">
          <div class="d-flex fill-height align-center justify-center">
            <v-scale-transition>
              <v-card color="transparent">
                <div class="d-flex align-center">
                  <v-img :src="img" height="90" width="90" cover class="ma-3"></v-img>

                  <div>
                    <v-card-title>Top western road trips</v-card-title>
                    <v-card-subtitle>1,000 miles of wonder</v-card-subtitle>
                  </div>
                </div>

                <v-card-actions>
                  <v-btn color="orange-lighten-2" text="Explore"></v-btn>
                  <v-spacer></v-spacer>
                </v-card-actions>
              </v-card>
            </v-scale-transition>
          </div>
        </v-card>
      </v-slide-group-item>
    </v-slide-group>
  </v-sheet>
</template>
