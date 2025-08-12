<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Sidebar from '@/components/Client dashboard/SidebarContainer.vue'
import Header from '@/components/HeaderSection.vue'
import Carousel from '@/components/Client dashboard/CarouselSection.vue'
import IconSection from '@/components/Client dashboard/IconSection.vue'
import { userCounterStore } from '@/stores/users'
import { useTheme } from 'vuetify'
import DOH from '@/assets/img/logo/doh.png'
import DSWD from '@/assets/img/logo/DSWD.SVG.png'
import MALASAKIT from '@/assets/img/logo/malasakit.jpg'
import LogoImage from '@/components/Client dashboard/LogoImage.vue'
import pcso from '@/assets/img/logo/pcso.jpg'
import Philhealth from '@/assets/img/logo/philhealth.jpg'

const theme = useTheme()

const drawer = ref(false)
const toggleDrawer = () => {
  drawer.value = !drawer.value
}

const userStore = userCounterStore()

onMounted(async () => {
  await userStore.fetchUsers()
})
</script>

<template>
  <Sidebar v-model="drawer" />

  <Header :toggleDrawer="toggleDrawer" />

  <div
    class="main-content"
    :class="theme.global.name.value === 'dark' ? 'bg-black' : 'bg-grey-lighten-1'"
    style="min-height: 100vh"
  >
    <v-container fluid>
      <v-row justify="center">
        <v-col cols="12" md="6">
          <Carousel />
        </v-col>

        <v-col cols="12" md="6">
          <hr />
          <br />
          <v-row class="justify-center">
            <v-col cols="2">
              <LogoImage :loc="DOH" />
            </v-col>
            <v-col cols="2">
              <LogoImage :loc="DSWD" />
            </v-col>
            <v-col cols="2">
              <LogoImage :loc="MALASAKIT" />
            </v-col>
            <v-col cols="2">
              <LogoImage :loc="pcso" />
            </v-col>
            <v-col cols="2">
              <LogoImage :loc="Philhealth" />
            </v-col>
          </v-row>
          <br />
          <hr />

          <IconSection />
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped>
.main-content {
  margin-top: 20px;
}

.content-wrapper {
  background-color: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}
</style>
