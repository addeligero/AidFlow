<template>
  <div class="pa-4 eligibility-chart-root border-md">
    <div class="d-flex align-center mb-3 header-row">
      <h2 class="text-h6 mb-0">Eligibility by Program</h2>
      <v-spacer />
      <v-btn
        size="small"
        variant="outlined"
        :disabled="loading"
        @click="reload"
        prepend-icon="mdi-refresh"
        >Refresh</v-btn
      >
    </div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-3" />
    <div v-if="chartData.labels.length" class="chart-container">
      <Bar :data="chartData" :options="options" class="chart" />
    </div>
    <v-empty-state
      v-else-if="!loading"
      icon="mdi-chart-bar"
      title="No Data"
      text="No programs found for this provider."
      class="mt-2"
    />
    <div class="text-caption text-medium-emphasis mt-3 info-text">
      Eligible client counts per program. Smaller bars mean fewer marked eligible.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import supabase from '../../lib/Supabase'
import { useUserStore } from '../../stores/users'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const userStore = useUserStore()

const loading = ref(false)
const error = ref<string | null>(null)
const chartData = ref<{
  labels: string[]
  datasets: Array<{ label: string; backgroundColor: string; data: number[]; borderRadius: number }>
}>({
  labels: [],
  datasets: [
    {
      label: 'Eligible Users',
      backgroundColor: '#10B981',
      data: [],
      borderRadius: 6,
    },
  ],
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  aspectRatio: 2, // will be overridden by container height
  animation: { duration: 450 },
  layout: { padding: { top: 8, right: 12, bottom: 4, left: 12 } },
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: 'Eligible Users per Program',
      font: { size: 14, weight: '600' },
      color: '#374151',
    },
    tooltip: {
      callbacks: {
        label: (ctx: any) => ` ${ctx.parsed.y} eligible`,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: '#4b5563', font: { size: 11 } },
      grid: { display: false },
    },
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1, color: '#4b5563', font: { size: 11 } },
      grid: { color: 'rgba(0,0,0,0.06)' },
    },
  },
}

async function reload() {
  loading.value = true
  error.value = null
  try {
    if (!userStore.isUserLoaded) await userStore.fetchUser()
    const providerId = userStore.user_id
    if (!providerId) throw new Error('Missing provider id')

    // 1) Fetch programs for this provider
    const { data: progRows, error: pErr } = await supabase
      .from('programs')
      .select('id,category')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
    if (pErr) throw pErr

    const programs = (progRows || []) as Array<{ id: number | string; category: string }>
    if (programs.length === 0) {
      chartData.value = { labels: [], datasets: [{ ...chartData.value.datasets[0], data: [] }] }
      return
    }

    const ids = programs.map((p) => p.id as string | number)

    // 2) Fetch eligible submissions for those program IDs
    const { data: subsRows, error: sErr } = await supabase
      .from('client_submissions')
      .select('program_id, decision_tree_result')
      .in('program_id', ids)
      .ilike('decision_tree_result', 'eligible%')
    if (sErr) throw sErr

    // 3) Count by program
    const counts = new Map<string, number>()
    for (const p of programs) counts.set(String(p.id), 0)
    for (const r of (subsRows || []) as Array<{ program_id: string | number }>) {
      const key = String(r.program_id)
      counts.set(key, (counts.get(key) || 0) + 1)
    }

    const labels = programs.map((p) => p.category)
    const data = programs.map((p) => counts.get(String(p.id)) || 0)

    chartData.value = {
      labels,
      datasets: [
        {
          ...chartData.value.datasets[0],
          data,
        },
      ],
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

reload()
</script>

<style scoped>
.eligibility-chart-root {
  max-width: 860px;
  margin: 0 auto;
}
.chart-container {
  max-width: 640px;
  margin: 0 auto;
  background: var(--v-theme-surface);
  border: 1px solid var(--v-theme-outline-variant);
  border-radius: 16px;
  padding: 12px 18px 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.chart {
  display: block;
  height: 320px; /* Controlled height */
}
@media (max-width: 640px) {
  .chart-container {
    padding: 8px 12px 6px;
  }
  .chart {
    height: 260px;
  }
}
.info-text {
  max-width: 640px;
  margin: 0 auto;
}
.header-row h2 {
  font-weight: 600;
}
</style>
