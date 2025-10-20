<template>
  <ClientLayout>
    <v-container fluid>
      <v-row>
        <v-col cols="12" class="pb-0">
          <br />
          <h3 class="text-h6 text-md-h5 mb-0">Subsidy Providers</h3>
          <Carousel />
        </v-col>
        <v-col cols="12" class="pt-0">
          <v-divider class="my-6" />
          <div class="d-flex align-center mb-4">
            <h3 class="text-h6 text-md-h5 mb-0">Programs and Requirements</h3>
            <v-spacer />
            <v-btn size="small" variant="text" prepend-icon="mdi-refresh" @click="refreshPrograms">
              Refresh
            </v-btn>
          </div>
          <v-row>
            <v-col v-for="p in programs" :key="p.id" cols="12" sm="6" md="4" lg="3" class="d-flex">
              <ProgramCard :program="p" class="w-100" />
            </v-col>
            <v-col v-if="programsLoading" cols="12" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" />
            </v-col>
            <v-col v-if="!programsLoading && !programs.length" cols="12" class="text-center py-8">
              <v-icon size="40" class="mb-2" color="primary" icon="mdi-file-search-outline" />
              <div class="text-body-2 text-medium-emphasis">No programs available yet.</div>
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-container>
  </ClientLayout>
</template>

<script setup lang="ts">
import { onMounted, computed, defineAsyncComponent } from 'vue'
const ClientLayout = defineAsyncComponent(() => import('../../layouts/ClientLayout.vue'))
const Carousel = defineAsyncComponent(
  () => import('../../components/Client dashboard/CarouselSection.vue'),
)
const ProgramCard = defineAsyncComponent(
  () => import('../../components/Client dashboard/ProgramCard.vue'),
)
import { useProgramsStore } from '../../stores/programs'

const programsStore = useProgramsStore()
const programs = computed(() => programsStore.programs)
const programsLoading = computed(() => programsStore.loading)
const refreshPrograms = () => programsStore.fetchPrograms()

onMounted(() => {
  if (!programs.value.length) programsStore.fetchPrograms()
})
</script>
