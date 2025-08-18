<script setup lang="ts">
import { useTheme } from 'vuetify'
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/users'

const route = useRoute()
const { toggleDrawer } = defineProps<{ toggleDrawer: () => void }>()

const theme = useTheme()
const savedTheme = localStorage.getItem('theme')
if (savedTheme) theme.global.name.value = savedTheme

const userStore = useUserStore()
const isLoggedIn = () => !!userStore.user?.id

const switching = ref(false)
function toggleTheme() {
  if (switching.value) return
  switching.value = true
  const next = theme.global.name.value === 'light' ? 'dark' : 'light'
  theme.global.name.value = next
  localStorage.setItem('theme', next)
  setTimeout(() => (switching.value = false), 400)
}

const appBarClasses = computed(() =>
  theme.global.name.value === 'dark' ? 'af-app-bar dark-gradient' : 'af-app-bar light-gradient',
)

const logoTextColor = computed(() =>
  theme.global.name.value === 'dark' ? 'text-white' : 'text-grey-darken-4',
)
</script>

<template>
  <v-app-bar density="comfortable" flat :class="appBarClasses" elevate-on-scroll>
    <div class="d-flex align-center" style="gap: 8px">
      <img
        src="@/assets/img/logo.png"
        alt="AidFlow Logo"
        class="mr-2"
        style="width: 32px; height: 32px"
      />
      <span class="text-h6 font-weight-bold" :class="logoTextColor"> AidFlow </span>
    </div>

    <v-spacer />

    <v-tooltip text="Toggle theme" location="bottom">
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          :icon="theme.global.name.value === 'light' ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          variant="tonal"
          color="primary"
          :loading="switching"
          @click="toggleTheme"
        />
      </template>
    </v-tooltip>

    <v-divider v-if="route.path !== '/' && isLoggedIn()" vertical class="mx-3 opacity-divider" />

    <v-btn
      v-if="route.path !== '/' && isLoggedIn()"
      variant="text"
      class="drawer-btn"
      :icon="true"
      @click="toggleDrawer"
    >
      <v-icon>mdi-menu</v-icon>
    </v-btn>
  </v-app-bar>
</template>

<style scoped>
.af-app-bar {
  backdrop-filter: blur(10px);
  transition:
    background 0.4s,
    color 0.3s;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  position: sticky;
  top: 0;
}

.light-gradient {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.65)),
    radial-gradient(circle at 120% 10%, rgba(120, 120, 255, 0.12), transparent 60%);
}

.dark-gradient {
  background:
    linear-gradient(135deg, rgba(18, 18, 22, 0.9), rgba(32, 32, 40, 0.82)),
    radial-gradient(circle at 110% 0%, rgba(130, 80, 255, 0.18), transparent 55%);
}

.af-logo-bg {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.15),
    rgba(var(--v-theme-primary), 0.05)
  );
  backdrop-filter: blur(4px);
}

.opacity-divider {
  opacity: 0.4;
}

.drawer-btn {
  color: var(--v-theme-on-surface);
  transition: background 0.25s;
}
.drawer-btn:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.app-title {
  letter-spacing: 0.5px;
}
</style>
