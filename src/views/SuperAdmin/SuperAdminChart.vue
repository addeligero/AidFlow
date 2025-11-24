<template>
  <div class="super-chart-root">
    <div class="chart-container">
      <Bar :data="data" :options="options" class="chart" />
    </div>
    <div class="text-caption text-medium-emphasis mt-3 info-text">
      Snapshot of platform scale and moderation state.
    </div>
  </div>
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
  labels: ['Providers', 'Programs', 'Approved', 'Rejected'],
  datasets: [
    {
      label: 'Count',
      backgroundColor: ['#2563EB', '#059669', '#10B981', '#DC2626'],
      data: [
        props.totalProviders,
        props.totalPrograms,
        props.approvedProviders,
        props.disapprovedProviders,
      ],
      borderRadius: 10,
      maxBarThickness: 72,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 500 },
  layout: { padding: { top: 12, right: 8, bottom: 4, left: 8 } },
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: 'Platform Overview',
      font: { size: 15, weight: '600' },
      color: '#1f2937',
    },
    tooltip: {
      callbacks: {
        label: (ctx: any) => ` ${ctx.parsed.y} total`,
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
      grid: { color: 'rgba(0,0,0,0.08)' },
    },
  },
}
</script>

<style scoped>
.super-chart-root {
  max-width: 860px;
  margin: 0 auto;
}
.chart-container {
  max-width: 640px;
  margin: 0 auto;
  background: var(--v-theme-surface);
  border: 1px solid var(--v-theme-outline-variant);
  border-radius: 18px;
  padding: 16px 22px 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.07);
}
.chart {
  height: 300px;
}
@media (max-width: 640px) {
  .chart-container {
    padding: 12px 14px 10px;
  }
  .chart {
    height: 250px;
  }
}
.info-text {
  max-width: 640px;
  margin: 0 auto;
}
</style>
