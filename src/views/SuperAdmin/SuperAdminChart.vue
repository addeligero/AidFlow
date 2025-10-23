<template>
  <Bar :data="data" :options="options" />
  <div class="text-caption text-medium-emphasis mt-2">Overview of providers and programs</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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

const props = defineProps<{
  totalProviders: number
  totalPrograms: number
  approvedProviders: number
  disapprovedProviders: number
}>()

const data = computed(() => ({
  labels: ['Providers', 'Programs', 'Approved Providers', 'Disapproved Providers'],
  datasets: [
    {
      label: 'Count',
      backgroundColor: ['#3B82F6', '#22C55E', '#10B981', '#EF4444'],
      data: [
        props.totalProviders,
        props.totalPrograms,
        props.approvedProviders,
        props.disapprovedProviders,
      ],
      borderRadius: 6,
    },
  ],
}))

const options = {
  responsive: true,
  plugins: {
    legend: { display: false },
    title: { display: true, text: 'Super Admin Overview' },
  },
  scales: {
    y: { beginAtZero: true, ticks: { stepSize: 1 } },
  },
}
</script>

<style scoped></style>
