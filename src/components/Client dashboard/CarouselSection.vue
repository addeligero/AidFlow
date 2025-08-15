<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { providersStore } from '@/stores/providers'

const store = providersStore()
const model = ref(null)

onMounted(() => {
  store.fetchProviders()
  console.log('Providers fetched:', store.providers)
})
watch(
  () => store.providers,
  (newVal) => {
    console.log('Providers updated:', newVal)
  },
  { deep: true },
)
</script>

<template>
  <v-sheet class="mx-auto" max-width="800" color="transparent">
    <v-slide-group v-model="model" selected-class="bg-success">
      <v-slide-group-item
        v-for="(provider, i) in store.providers"
        :key="i"
        v-slot="{ toggle, selectedClass }"
      >
        <v-card :class="['ma-4', selectedClass]" height="150" width="250" @click="toggle">
          <div class="d-flex fill-height align-center justify-center">
            <v-scale-transition>
              <v-card color="transparent">
                <div class="d-flex align-center">
                  <v-img :src="provider.logo" height="90" width="90" cover class="ma-3" />
                  <div>
                    <v-card-title>{{ provider.agencyName }}</v-card-title>
                    <v-card-subtitle>Provider</v-card-subtitle>
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
