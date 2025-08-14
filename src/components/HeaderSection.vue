<script setup lang="ts">
import { useTheme } from 'vuetify'
import { watch, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/users'

const route = useRoute()
const { toggleDrawer } = defineProps({
  toggleDrawer: {
    type: Function,
    default: () => {},
  },
})

// Theme toggle
const theme = useTheme()
const savedTheme = localStorage.getItem('theme')
if (savedTheme) {
  theme.global.name.value = savedTheme
}

function onClick() {
  const newTheme = theme.global.name.value === 'light' ? 'dark' : 'light'
  theme.global.name.value = newTheme
  localStorage.setItem('theme', newTheme)
}

const userStore = useUserStore()
const drawer = ref(false)
const group = ref(null)

const isLoggedIn = () => !!userStore.user?.id

watch(group, () => {
  drawer.value = true
})

onMounted(() => {
  if (isLoggedIn()) {
    drawer.value = true
    toggleDrawer()
  } else {
    drawer.value = false
  }
})
</script>

<template>
  <v-app-bar class="px-3 backward">
    <h3>AidFlow</h3>
    <v-spacer></v-spacer>

    <v-btn
      class="border rounded text-center"
      :prepend-icon="
        theme.global.name.value === 'light' ? 'mdi-weather-sunny' : 'mdi-weather-night'
      "
      slim
      @click="onClick"
    ></v-btn>

    <!-- Show only if user is logged in -->
    <v-btn v-if="route.path !== '/' && isLoggedIn()" @click="toggleDrawer">
      <v-app-bar-nav-icon class="fill-height" variant="text"></v-app-bar-nav-icon>
    </v-btn>
  </v-app-bar>
  <br />
</template>

<style scoped>
.backward {
  position: relative;
  z-index: 1;
}
</style>
