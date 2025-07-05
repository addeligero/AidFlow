<script setup lang="ts">
import { userCounterStore } from '@/stores/users'
import supabase from '@/lib/Supabase'

const userStore = userCounterStore()

const props = defineProps({
  modelValue: Boolean,
})
const emit = defineEmits(['update:modelValue'])

const logout = async () => {
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Logout failed:', error.message)
  } else {
    window.location.href = '/'
  }
}
const navigate = (route: string) => {
  emit('update:modelValue', false)
  window.location.href = `/${route}`
}
</script>
<template>
  <v-navigation-drawer
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    temporary
    class="drawer-root d-flex flex-column"
  >
    <div class="drawer-content">
      <v-list-item
        v-if="userStore.isUserLoaded"
        prepend-avatar="https://randomuser.me/api/portraits/men/78.jpg"
        :subtitle="userStore.userEmail"
        :title="userStore.userFullName"
      />
      <v-list-item
        v-else
        prepend-avatar="https://randomuser.me/api/portraits/men/78.jpg"
        title="Loading..."
      />

      <v-divider></v-divider>

      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Home"
          value="home"
          @click="() => navigate('dashboard')"
        />
        <v-list-item prepend-icon="mdi-forum" title="About" value="about" />
      </v-list>
    </div>

    <v-btn
      block
      color="error"
      class="logout-btn fixed-logout"
      prepend-icon="mdi-logout"
      @click="logout"
    >
      Logout
    </v-btn>
  </v-navigation-drawer>
</template>

<style scoped>
.drawer-root {
  position: relative;
  height: 100vh;
}
.drawer-content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  padding-bottom: 70px;
}
.logout-btn {
  font-weight: bold;
  color: white;
  border-radius: 8px;
  text-transform: uppercase;
}
.fixed-logout {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0 0 12px 0;
  width: calc(100% - 0px);
  z-index: 2;
}
</style>
