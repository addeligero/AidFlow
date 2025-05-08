// import './assets/main.css'

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import '@mdi/font/css/materialdesignicons.css'

const savedTheme = localStorage.getItem('theme') || 'light'
const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: savedTheme,
    themes: {
      light: {
        colors: {
          background: '#ffffff',
          surface: '#ffffff',
          primary: '#6200ea',
          secondary: '#03dac6',
          error: '#b00020',
          info: '#2196f3',
          success: '#4caf50',
          warning: '#fb8c00',
        },
      },
      dark: {
        colors: {
          background: '#121212',
          surface: '#424242',
          primary: '#bb86fc',
          secondary: '#03dac6',
          error: '#cf6679',
          info: '#2196f3',
          success: '#4caf50',
          warning: '#fb8c00',
        },
      },
    },
  },
})
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

// Watch for changes to the theme and update localStorage
watch(
  () => vuetify.theme.global.name.value,
  (newTheme) => {
    localStorage.setItem('theme', newTheme)
  },
)

app.mount('#app')
