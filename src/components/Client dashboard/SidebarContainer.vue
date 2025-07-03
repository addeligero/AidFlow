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
    class="d-flex flex-column"
  >
    <div>
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

    <v-spacer></v-spacer>

    <v-btn
      block
      color="error"
      class="mt-4 mb-4 logout-btn"
      prepend-icon="mdi-logout"
      @click="logout"
    >
      Logout
    </v-btn>
  </v-navigation-drawer>
</template>

<style scoped>
.logout-btn {
  font-weight: bold;
  color: white;
  border-radius: 8px;
  text-transform: uppercase;
}
</style>
