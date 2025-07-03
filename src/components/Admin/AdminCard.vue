<script setup lang="ts">
import image from '@/assets/img/admin/rules.png'

const props = defineProps<{
  title?: string
  subHeader?: string
  shortStatement?: string
  buttonText?: string
}>()

const title = props.title ?? 'title'
const subHeader = props.subHeader ?? 'Headings'
const shortStatement = props.shortStatement ?? 'Short Statement'
const buttonText = props.buttonText ?? 'Button Text'
</script>
<template>
  <v-card class="mx-auto" max-width="400">
    <v-img class="align-end text-white" height="200" :src="image">
      <v-card-title>{{ title }}</v-card-title>
    </v-img>

    <v-card-subtitle class="pt-4"> {{ subHeader }}</v-card-subtitle>

    <v-card-text>
      <div>{{ shortStatement }}</div>
    </v-card-text>

    <v-card-actions>
      <v-btn color="orange" :text="buttonText"></v-btn>

      <v-btn color="orange" text="Explore"></v-btn>
    </v-card-actions>
  </v-card>
</template>
