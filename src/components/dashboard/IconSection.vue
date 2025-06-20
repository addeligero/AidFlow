<template>
  <v-card
    class="mx-auto"
    max-width="344"
    title="Upload Image"
    subtitle="Check your eligibility"
    elevation="8"
  >
    <v-card-actions>
      <v-btn @click="takePicture" prepend-icon="mdi-camera">Take Photo</v-btn>
    </v-card-actions>

    <v-img v-if="photo" :src="photo" height="200" class="mt-4" />
  </v-card>
</template>

<script setup>
import { ref } from 'vue'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

const photo = ref(null)

const takePicture = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    })

    photo.value = image.dataUrl
  } catch (error) {
    console.error('Camera error:', error)
  }
}
</script>
