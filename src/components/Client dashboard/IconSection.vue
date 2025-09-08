<script setup lang="ts">
import { ref } from 'vue'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

defineProps<{
  Title: string
  Subtitle: string
}>()

const photo = ref<string | null>(null)

const takePicture = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    })

    photo.value = image.dataUrl ?? null
  } catch (error) {
    console.error('Camera error:', error)
  }
}
</script>

<template>
  <v-card class="mx-auto" max-width="344" :title="Title" :subtitle="Subtitle" elevation="8">
    <v-card-actions>
      <v-btn @click="takePicture" prepend-icon="mdi-camera">Take Photo</v-btn>
    </v-card-actions>

    <v-img v-if="photo" :src="photo" height="200" class="mt-4" />
  </v-card>
</template>
