<script setup lang="ts">
import { onMounted, ref, computed, defineAsyncComponent } from 'vue'
import { providersStore } from '../../stores/providers'
import { useProgramsStore } from '../../stores/programs'
const ClientLayout = defineAsyncComponent(() => import('../../layouts/ClientLayout.vue'))

const providers = providersStore() as unknown as {
  providers: Array<{ id: string | number; agency_name: string; logo?: string; program?: string }>
  fetchProviders: () => Promise<void>
}
const programsStore = useProgramsStore()

const search = ref('')
const expanded = ref<string[]>([])

onMounted(async () => {
  if (providers.providers.length === 0) {
    await providers.fetchProviders()
  }
  if (programsStore.programs.length === 0) {
    await programsStore.fetchProgramsByProvider()
  }
})

const providerMap = computed(() => {
  const map = new Map<string, { agency_name: string; logo?: string; program?: string }>()
  for (const p of providers.providers) {
    map.set(String(p.id), {
      agency_name: p.agency_name,
      logo: p.logo,
      program: p.program ?? undefined,
    })
  }
  return map
})

function getProviderFor(program: { provider_id: string | number }) {
  return providerMap.value.get(String(program.provider_id)) || {
    agency_name: 'Unknown Provider',
    logo: undefined,
    program: undefined,
  }
}

const filteredPrograms = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = programsStore.programs
  if (!q) return list
  return list.filter((p) => {
    const provider = getProviderFor(p)
    const reqNames = (p.requirements || []).map((r) => (r && r.name ? String(r.name).toLowerCase() : ''))
    const rulesFields = (p.rules || []).map((r) => (r && r.field ? String(r.field).toLowerCase() : ''))
    return (
      p.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      provider.agency_name.toLowerCase().includes(q) ||
      reqNames.some((n: string) => n.includes(q)) ||
      rulesFields.some((n: string) => n.includes(q))
    )
  })
})

function toggleExpand(id: string) {
  if (expanded.value.includes(id)) {
    expanded.value = expanded.value.filter((x) => x !== id)
  } else {
    expanded.value.push(id)
  }
}
</script>

<template>
  <ClientLayout>
    <v-container fluid class="py-6">
      <!-- Header -->
      <v-row class="align-center mb-4" no-gutters>
        <v-col cols="12" md="6" class="d-flex align-center mb-2 mb-md-0">
          <h2 class="text-h5 font-weight-medium me-3">Programs</h2>
          <v-chip size="small" color="primary" variant="flat">
            {{ programsStore.programs.length }} total
          </v-chip>
        </v-col>
        <v-col cols="12" md="6" class="d-flex justify-end">
          <v-text-field
            v-model="search"
            density="comfortable"
            hide-details
            prepend-inner-icon="mdi-magnify"
            label="Search programs, providers, or fields"
            max-width="400"
          />
        </v-col>
      </v-row>

      <!-- Programs list -->
      <v-row>
        <!-- Loading state -->
        <v-col cols="12" v-if="programsStore.loading" class="d-flex justify-center py-10">
          <v-progress-circular indeterminate color="primary" />
        </v-col>

        <!-- Programs -->
        <v-col v-for="program in filteredPrograms" :key="program.id" cols="12" md="6" lg="4" class="d-flex">
          <v-card
            class="flex-grow-1 d-flex flex-column"
            :elevation="expanded.includes(program.id) ? 8 : 2"
          >
            <v-card-item>
              <template #prepend>
                <v-avatar size="48" class="me-3" variant="tonal">
                  <v-img :src="getProviderFor(program).logo" alt="logo" cover />
                </v-avatar>
              </template>

              <v-card-title>{{ program.name }}</v-card-title>
              <v-card-subtitle>
                <span class="me-2">{{ getProviderFor(program).agency_name }}</span>
                <v-chip size="x-small" color="secondary" variant="tonal" class="me-2" v-if="program.category">
                  {{ program.category }}
                </v-chip>
                <v-chip size="x-small" variant="flat" color="primary" class="me-2">
                  {{ program.requirements.length }} requirements
                </v-chip>
                <v-chip size="x-small" variant="outlined">
                  {{ program.rules.length }} rules
                </v-chip>
              </v-card-subtitle>

              <template #append>
                <v-btn
                  variant="text"
                  size="small"
                  :icon="expanded.includes(program.id) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                  @click="toggleExpand(program.id)"
                />
              </template>
            </v-card-item>

            <v-expand-transition>
              <div v-show="expanded.includes(program.id)">
                <v-divider />
                <v-card-text class="py-3">
                  <h4 class="text-subtitle-1 mb-2">Requirements</h4>
                  <v-table density="compact" v-if="program.requirements.length">
                    <thead>
                      <tr>
                        <th class="text-caption text-medium-emphasis">Type</th>
                        <th class="text-caption text-medium-emphasis">Name</th>
                        <th class="text-caption text-medium-emphasis">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(req, i) in program.requirements" :key="i">
                        <td class="text-body-2">{{ req.type }}</td>
                        <td class="text-body-2 font-weight-medium">{{ req.name }}</td>
                        <td class="text-body-2">
                          <span v-if="req.type === 'document'">{{ req.description || '—' }}</span>
                          <span v-else>{{ req.field_key }} {{ req.operator }} {{ req.value ?? '—' }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                  <div v-else class="text-medium-emphasis text-caption mb-2">No requirements defined.</div>

                  <h4 class="text-subtitle-1 mt-4 mb-2">Rules</h4>
                  <v-table density="compact" v-if="program.rules.length">
                    <thead>
                      <tr>
                        <th class="text-caption text-medium-emphasis">Field</th>
                        <th class="text-caption text-medium-emphasis">Operator</th>
                        <th class="text-caption text-medium-emphasis">Value</th>
                        <th class="text-caption text-medium-emphasis">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(rl, j) in program.rules" :key="j">
                        <td class="text-body-2 font-weight-medium">{{ rl.field }}</td>
                        <td class="text-body-2">{{ rl.operator }}</td>
                        <td class="text-body-2">{{ rl.value }}</td>
                        <td class="text-body-2">{{ rl.note || '—' }}</td>
                      </tr>
                    </tbody>
                  </v-table>
                  <div v-else class="text-medium-emphasis text-caption">No rules defined.</div>
                </v-card-text>
              </div>
            </v-expand-transition>

            <v-divider />
            <v-card-actions class="py-2">
              <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-information">Details</v-btn>
              <v-spacer />
              <v-chip size="x-small" variant="tonal">Updated {{ program.updated_at ? new Date(program.updated_at).toLocaleDateString() : '—' }}</v-chip>
            </v-card-actions>
          </v-card>
        </v-col>

        <!-- Empty state -->
        <v-col cols="12" v-if="!programsStore.loading && !filteredPrograms.length" class="py-10">
          <v-empty-state
            headline="No programs found"
            title="No programs"
            text="Try adding a program or adjust your search."
            icon="mdi-view-list-outline"
          />
        </v-col>
      </v-row>
    </v-container>
  </ClientLayout>
</template>
