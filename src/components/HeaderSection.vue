<script setup lang="ts">
import { useTheme } from 'vuetify'
import { watch, ref, onMounted } from 'vue'

// Props

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

const drawer = ref(false)
const group = ref(null)
const userStatus = ref('')
userStatus.value = 'loggedIn'

// Check user status
const checkStatus = () => {
  // const token = localStorage.getItem('token')
  // userStatus.value = token ? 'loggedIn' : 'loggedOut'
  userStatus.value = 'loggedIn'
}

watch(group, () => {
  drawer.value = true
  checkStatus()
})

onMounted(() => {
  if (userStatus.value === 'loggedIn') {
    drawer.value = true
    toggleDrawer()
  } else {
    drawer.value = false
  }

  checkStatus()
})
</script>

<template>
  <v-app-bar class="px-3 backward">
    <h3>AidFlow</h3>
    <v-spacer></v-spacer>

    <v-btn
      :prepend-icon="
        theme.global.name.value === 'light' ? 'mdi-weather-sunny' : 'mdi-weather-night'
      "
      :text="theme.global.name.value === 'light' ? 'Light' : 'Dark'"
      slim
      @click="onClick"
    ></v-btn>

    <!-- Show the toggle drawer icon only if the user is logged in -->
    <v-btn v-if="userStatus === 'loggedIn'" @click="toggleDrawer">
      <v-app-bar-nav-icon class="fill-height" variant="text"></v-app-bar-nav-icon>
    </v-btn>
  </v-app-bar>
</template>

<style scoped>
.backward {
  position: relative;
  z-index: 1;
}
</style>
