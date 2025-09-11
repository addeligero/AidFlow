<template>
  <ClientLayout>
    <v-container fluid>
      <v-row>
        <v-col cols="12" class="pb-0">
          <Carousel />
        </v-col>
        <v-col cols="12" class="pt-0">
          <v-divider class="my-6" />
          <div class="d-flex align-center mb-4">
            <h3 class="text-h6 text-md-h5 mb-0">Available Subsidy Requirements</h3>
            <v-spacer />
            <v-btn size="small" variant="text" prepend-icon="mdi-refresh" @click="refreshRules">
              Refresh
            </v-btn>
          </div>
          <v-row>
            <v-col v-for="r in rules" :key="r.id" cols="12" sm="6" md="4" lg="3" class="d-flex">
              <IconSection :rule="r" class="w-100" />
            </v-col>
            <v-col v-if="rulesLoading" cols="12" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" />
            </v-col>
            <v-col v-if="!rulesLoading && !rules.length" cols="12" class="text-center py-8">
              <v-icon size="40" class="mb-2" color="primary" icon="mdi-file-search-outline" />
              <div class="text-body-2 text-medium-emphasis">No subsidy rules available yet.</div>
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-container>
  </ClientLayout>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import ClientLayout from '@/layouts/ClientLayout.vue'
import Carousel from '@/components/Client dashboard/CarouselSection.vue'
import IconSection from '@/components/Client dashboard/IconSection.vue'
import { providersStore } from '@/stores/providers'

const ps = providersStore()

const rules = computed(() => ps.rules)
const rulesLoading = computed(() => (ps as any).rulesLoading)

const refreshRules = () => {
  ps.fetchRules()
}

onMounted(() => {
  if (!ps.rules.length) ps.fetchRules()
})
</script>
