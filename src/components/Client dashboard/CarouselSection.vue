<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { providersStore } from '@/stores/providers'

const store = providersStore()

// v-slide-group model (index)
const model = ref<number | null>(0)

const showHint = ref(true)
const containerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (store.providers.length === 0) {
    store.fetchProviders()
  }
  // Auto-hide hint after 6s
  setTimeout(() => (showHint.value = false), 6000)
})

// Hide hint on first user interaction
function firstInteract() {
  if (showHint.value) showHint.value = false
}

function scrollNext() {
  firstInteract()
  // Advance one item if possible
  if (model.value == null) model.value = 0
  else if (model.value < store.providers.length - 1) model.value++
}

function scrollPrev() {
  firstInteract()
  if (model.value && model.value > 0) model.value--
}

// Allow mouse wheel vertical to act as horizontal scrolling
function onWheel(e: WheelEvent) {
  if (!store.providers.length) return
  // Only act if vertical intent is stronger
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault()
    if (e.deltaY > 0) scrollNext()
    else scrollPrev()
  }
}

// Watch model for interactions
watch(model, () => firstInteract())
</script>

<template>
  <div class="provider-slider-wrapper" ref="containerRef" @wheel.passive="onWheel">
    <div class="edge-fade left" v-if="(model || 0) > 0"></div>
    <div
      class="edge-fade right"
      v-if="store.providers.length && (model || 0) < store.providers.length - 1"
    ></div>

    <transition name="fade">
      <div
        v-if="showHint && store.providers.length"
        class="scroll-hint d-flex align-center"
        @click="firstInteract"
      >
        <v-icon size="18" class="me-1 animate-nudge">mdi-swap-horizontal</v-icon>
        Scroll / Drag
      </div>
    </transition>

    <v-btn
      v-if="(model || 0) > 0"
      variant="flat"
      size="small"
      density="comfortable"
      class="nav-btn prev"
      @click="scrollPrev"
      icon="mdi-chevron-left"
    />
    <v-btn
      v-if="store.providers.length && (model || 0) < store.providers.length - 1"
      variant="flat"
      size="small"
      density="comfortable"
      class="nav-btn next"
      @click="scrollNext"
      icon="mdi-chevron-right"
    />

    <v-slide-group
      v-model="model"
      class="pt-2 pb-4"
      selected-class="selected-chip"
      center-active
      show-arrows="false"
      @mousedown="firstInteract"
      @touchstart="firstInteract"
    >
      <v-slide-group-item
        v-for="(provider, i) in store.providers"
        :key="i"
        v-slot="{ toggle, selected }"
      >
        <v-card
          class="provider-card mx-3 my-4 border-lg"
          :elevation="selected ? 8 : 2"
          rounded="lg"
          @click="(toggle(), firstInteract())"
        >
          <div class="d-flex align-center pa-3">
            <v-avatar size="70" class="me-4 soft-avatar" rounded>
              <v-img :src="provider.logo" alt="logo" cover />
            </v-avatar>
            <div class="text-truncate">
              <h4 class="mb-1 text-subtitle-1 font-weight-medium provider-name">
                {{ provider.agencyName }}
              </h4>
              <div class="text-caption text-medium-emphasis">Service Provider</div>
            </div>
          </div>
          <v-divider />
          <div class="d-flex align-center px-3 py-2">
            <v-btn
              variant="text"
              color="primary"
              size="small"
              append-icon="mdi-arrow-right"
              class="ms-n2"
            >
              Explore
            </v-btn>
            <v-spacer />
            <v-chip
              size="x-small"
              color="primary"
              variant="flat"
              class="text-uppercase letter-space"
            >
              New
            </v-chip>
          </div>
          <v-overlay
            :model-value="selected"
            contained
            scrim="rgba(0,0,0,0.25)"
            class="d-flex align-center justify-center selection-overlay"
          >
            <v-icon color="white" size="34">mdi-check-circle</v-icon>
          </v-overlay>
        </v-card>
      </v-slide-group-item>
    </v-slide-group>

    <div v-if="!store.providers.length" class="placeholder-container">
      <v-progress-circular indeterminate color="primary" />
    </div>
  </div>
</template>

<style scoped>
.provider-slider-wrapper {
  position: relative;
  max-width: 100%;
  overflow: hidden;
  padding-inline: 8px;
}

.provider-card {
  width: 260px;
  min-width: 260px;
  cursor: pointer;
  transition:
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.28s;
  position: relative;
  background: linear-gradient(135deg, var(--v-theme-surface) 0%, rgba(255, 255, 255, 0.04) 100%);
}

.provider-card:hover {
  transform: translateY(-4px);
}

.provider-card:active {
  transform: translateY(-1px) scale(0.99);
}

.soft-avatar {
  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 255, 255, 0.35),
    rgba(255, 255, 255, 0.05)
  );
  border: 1px solid rgba(var(--v-border-color), 0.1);
  overflow: hidden;
}

.provider-name {
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.selected-chip {
  outline: 2px solid var(--v-theme-primary);
  outline-offset: 2px;
  border-radius: 14px;
}

.selection-overlay {
  transition: opacity 0.25s;
}

.scroll-hint {
  position: absolute;
  top: 4px;
  right: 12px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  padding: 4px 10px;
  font-size: 0.72rem;
  border-radius: 24px;
  letter-spacing: 0.5px;
  backdrop-filter: blur(4px);
  z-index: 6;
  user-select: none;
  cursor: pointer;
  animation: fadeIn 0.5s ease;
}

.animate-nudge {
  animation: nudge 1.4s ease-in-out infinite;
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  background: rgba(0, 0, 0, 0.45) !important;
  color: #fff !important;
  backdrop-filter: blur(4px);
  transition: background 0.25s;
}

.nav-btn:hover {
  background: rgba(0, 0, 0, 0.7) !important;
}

.nav-btn.prev {
  left: 4px;
}
.nav-btn.next {
  right: 4px;
}

.edge-fade {
  position: absolute;
  top: 0;
  width: 52px;
  height: 100%;
  z-index: 4;
  pointer-events: none;
}

.edge-fade.left {
  left: 0;
  background: linear-gradient(to right, var(--v-theme-background), rgba(0, 0, 0, 0));
}

.edge-fade.right {
  right: 0;
  background: linear-gradient(to left, var(--v-theme-background), rgba(0, 0, 0, 0));
}

.placeholder-container {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes nudge {
  0%,
  60%,
  100% {
    transform: translateX(0);
    opacity: 1;
  }
  30% {
    transform: translateX(-4px);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.letter-space {
  letter-spacing: 1px;
}
</style>
