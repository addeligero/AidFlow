<script setup lang="ts">
import { onMounted, ref, computed, defineAsyncComponent } from 'vue'
const Sidebar = defineAsyncComponent(() => import('../components/Client dashboard/SidebarContainer.vue'))
const Header = defineAsyncComponent(() => import('../components/HeaderSection.vue'))
import { useUserStore } from '../stores/users'
import { useTheme } from 'vuetify'

const theme = useTheme()
const drawer = ref(false)
const toggleDrawer = () => (drawer.value = !drawer.value)

const userStore = useUserStore()
onMounted(async () => {
  if (!userStore.isUserLoaded) await userStore.fetchUser()
})

const shellClass = computed(() =>
  theme.global.name.value === 'dark' ? 'shell shell-dark' : 'shell shell-light',
)
</script>

<template>
  <Sidebar v-model="drawer" />
  <Header :toggleDrawer="toggleDrawer" />

  <div :class="shellClass">
    <div class="content-wrapper">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  padding: 24px 20px 60px;
  transition: background 0.5s;
}

/* 🌞 Light Mode */
.shell-light {
  background:
    radial-gradient(circle at 85% 15%, rgba(59, 130, 246, 0.18), transparent 60%),
    linear-gradient(180deg, #ffffff, #f1f5f9);
}

/* 🌙 Dark Mode */
.shell-dark {
  background:
    radial-gradient(circle at 80% 10%, rgba(37, 99, 235, 0.35), transparent 55%),
    radial-gradient(circle at 5% 90%, rgba(59, 130, 246, 0.25), transparent 60%),
    linear-gradient(180deg, #0f172a, #1e293b);
}

.content-wrapper {
  max-width: 1480px;
  margin: 0 auto;
  padding: 12px 4px;
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
