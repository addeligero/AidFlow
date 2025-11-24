<template>
  <div class="pa-4">
    <div class="d-flex align-center mb-2">
      <h2 class="text-h6 mb-0">Eligibility by Program</h2>
      <v-spacer />
      <v-btn size="small" variant="outlined" :disabled="loading" @click="reload">Refresh</v-btn>
    </div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-3" />
    <Bar v-if="chartData.labels.length" :data="chartData" :options="options" />
    <div v-else-if="!loading" class="text-caption text-medium-emphasis mt-2">
      No programs found.
    </div>
    <div class="text-caption text-medium-emphasis mt-2">
      Counts of clients marked eligible per program
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
  plugins: {
    legend: { display: false },
    title: { display: true, text: 'Eligible Users per Program' },
  },
  scales: {
    y: { beginAtZero: true, ticks: { stepSize: 1 } },
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
      .select('id,name')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
    if (pErr) throw pErr

    const programs = (progRows || []) as Array<{ id: number | string; name: string }>
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

    const labels = programs.map((p) => p.name)
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

<style scoped></style>
