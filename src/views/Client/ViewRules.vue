<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { providersStore } from '@/stores/providers'
import ClientLayout from '@/layouts/ClientLayout.vue'

const store = providersStore()
const search = ref('')
const expanded = ref<string[]>([])

onMounted(() => {
  store.fetchRules()
  console.log('rles', store.rules)
})

const filteredRules = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.rules
  return store.rules.filter(
    (r) =>
      r.rule_name.toLowerCase().includes(q) ||
      r.provider.agency_name.toLowerCase().includes(q) ||
      Object.keys(r.conditions || {}).some((k) => k.toLowerCase().includes(q)),
  )
})

function toggleExpand(id: string) {
  if (expanded.value.includes(id)) {
    expanded.value = expanded.value.filter((x) => x !== id)
  } else {
    expanded.value.push(id)
  }
}

function copyRule(rule: any) {
  try {
    const json = JSON.stringify(rule, null, 2)
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(json)
    }
  } catch (e) {
    console.error('Failed to copy rule JSON:', e)
    alert('Failed to copy rule JSON. Please try again.')
  }
}
</script>

<template>
  <ClientLayout>
    <v-container fluid class="py-6">
      <!-- Header -->
      <v-row class="align-center mb-4" no-gutters>
        <v-col cols="12" md="6" class="d-flex align-center mb-2 mb-md-0">
          <h2 class="text-h5 font-weight-medium me-3">Subsidy Rules</h2>
          <v-chip size="small" color="primary" variant="flat">
            {{ store.rules.length }} total
          </v-chip>
        </v-col>
        <v-col cols="12" md="6" class="d-flex justify-end">
          <v-text-field
            v-model="search"
            density="comfortable"
            hide-details
            prepend-inner-icon="mdi-magnify"
            label="Search rules, providers or conditions"
            max-width="400"
          />
        </v-col>
      </v-row>

      <!-- Rules list -->
      <v-row>
        <!-- Loading state -->
        <v-col cols="12" v-if="store.rulesLoading" class="d-flex justify-center py-10">
          <v-progress-circular indeterminate color="primary" />
        </v-col>

        <!-- Rules -->
        <v-col v-for="rule in filteredRules" :key="rule.id" cols="12" md="6" lg="4" class="d-flex">
          <v-card
            class="flex-grow-1 d-flex flex-column"
            :elevation="expanded.includes(rule.id) ? 8 : 2"
          >
            <v-card-item>
              <template #prepend>
                <v-avatar size="48" class="me-3" variant="tonal">
                  <v-img :src="rule.provider.logo" alt="logo" cover />
                </v-avatar>
              </template>

              <v-card-title>{{ rule.rule_name }}</v-card-title>
              <v-card-subtitle>
                <span class="me-2">{{ rule.provider.agency_name }}</span>
                <v-chip size="x-small" color="primary" variant="flat" class="me-2">
                  ₱ {{ rule.subsidy_amount ?? '—' }}
                </v-chip>
                <v-chip
                  size="x-small"
                  color="secondary"
                  variant="tonal"
                  v-if="Object.keys(rule.conditions).length"
                >
                  {{ Object.keys(rule.conditions).length }} conditions
                </v-chip>
                <v-chip size="x-small" variant="outlined" v-else>No conditions</v-chip>
              </v-card-subtitle>

              <template #append>
                <v-btn
                  variant="text"
                  size="small"
                  :icon="expanded.includes(rule.id) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                  @click="toggleExpand(rule.id)"
                />
              </template>
            </v-card-item>

            <v-expand-transition>
              <div v-show="expanded.includes(rule.id)">
                <v-divider />
                <v-card-text class="py-3">
                  <v-table density="compact" v-if="Object.keys(rule.conditions).length">
                    <thead>
                      <tr>
                        <th class="text-caption text-medium-emphasis">Condition</th>
                        <th class="text-caption text-medium-emphasis">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(val, key) in rule.conditions" :key="key">
                        <td class="text-body-2 font-weight-medium">{{ key }}</td>
                        <td class="text-body-2">{{ val }}</td>
                      </tr>
                    </tbody>
                  </v-table>
                  <div v-else class="text-medium-emphasis text-caption">No conditions defined.</div>
                </v-card-text>
              </div>
            </v-expand-transition>

            <v-divider />
            <v-card-actions class="py-2">
              <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-information">
                Details
              </v-btn>
              <v-spacer />
              <v-tooltip text="Copy rule JSON" location="top">
                <template #activator="{ props }">
                  <v-btn v-bind="props" icon size="small" @click="copyRule(rule)">
                    <v-icon size="18">mdi-content-copy</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
            </v-card-actions>
          </v-card>
        </v-col>

        <!-- Empty state -->
        <v-col cols="12" v-if="!store.rulesLoading && !filteredRules.length" class="py-10">
          <v-empty-state
            headline="No rules found"
            title="No subsidy rules"
            text="Try adding a rule or adjust your search."
            icon="mdi-clipboard-list-outline"
          />
        </v-col>
      </v-row>
    </v-container>
  </ClientLayout>
</template>
