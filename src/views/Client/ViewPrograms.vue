<script setup lang="ts">
import { onMounted, ref, computed, defineAsyncComponent } from 'vue'
const ClientLayout = defineAsyncComponent(() => import('../../layouts/ClientLayout.vue'))
const ProgramCard = defineAsyncComponent(
  () => import('../../components/Client dashboard/ProgramCard.vue'),
)
import { useProgramsStore } from '../../stores/programs'

const programsStore = useProgramsStore()
const search = ref('')

onMounted(() => {
  if (!programsStore.programs.length) programsStore.fetchPrograms()
})

const programs = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = programsStore.programs
  if (!q) return list
  return list.filter((p) => {
    const hay = [
      p.name,
      p.category || '',
      p.description || '',
      ...p.requirements.map((r) => `${r.name} ${r.description || ''}`),
      ...p.rules.map((r) => `${r.field} ${r.operator} ${r.value ?? ''}`),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

const loading = computed(() => programsStore.loading)
const refresh = () => programsStore.fetchPrograms()
</script>

<template>
  <ClientLayout>
    <v-container fluid class="py-6">
      <v-row class="align-center mb-4" no-gutters>
        <v-col cols="12" md="6" class="d-flex align-center mb-2 mb-md-0">
          <h2 class="text-h5 font-weight-medium me-3">Subsidy Programs</h2>
          <v-chip size="small" color="primary" variant="flat">{{ programs.length }} total</v-chip>
        </v-col>
        <v-col cols="12" md="6" class="d-flex justify-end">
          <v-text-field
            v-model="search"
            density="comfortable"
            hide-details
            prepend-inner-icon="mdi-magnify"
            label="Search programs or requirements"
            max-width="400"
          />
          <v-btn
            class="ml-2"
            size="small"
            variant="text"
            prepend-icon="mdi-refresh"
            @click="refresh"
          >
            Refresh
          </v-btn>
        </v-col>
      </v-row>

      <v-row>
        <v-col v-if="loading" cols="12" class="d-flex justify-center py-10">
          <v-progress-circular indeterminate color="primary" />
        </v-col>

        <v-col v-for="p in programs" :key="p.id" cols="12" md="6" lg="4" class="d-flex">
          <ProgramCard :program="p" class="w-100" />
        </v-col>

        <v-col cols="12" v-if="!loading && !programs.length" class="py-10">
          <v-empty-state
            headline="No programs found"
            title="No subsidy programs"
            text="Try adding a program or adjust your search."
            icon="mdi-clipboard-list-outline"
          />
        </v-col>
      </v-row>
    </v-container>
  </ClientLayout>
</template>
