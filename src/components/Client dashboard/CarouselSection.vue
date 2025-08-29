<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { providersStore } from '@/stores/providers'

const store = providersStore()

const model = ref<number | null>(0)

const showHint = ref(true)
const containerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (store.providers.length === 0) {
    store.fetchProviders()
  }

  setTimeout(() => (showHint.value = false), 8000)
})

function firstInteract() {
  if (showHint.value) showHint.value = false
}

function scrollNext() {
  firstInteract()

  if (model.value == null) model.value = 0
  else if (model.value < store.providers.length - 1) model.value++
}

function scrollPrev() {
  firstInteract()
  if (model.value && model.value > 0) model.value--
}

function onWheel(e: WheelEvent) {
  if (!store.providers.length) return

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
  <div
    class="position-relative overflow-hidden px-2"
    ref="containerRef"
    @wheel.passive="onWheel"
    style="max-width: 100%"
  >
    <div
      v-if="(model || 0) > 0"
      class="position-absolute top-0 left-0"
      style="
        width: 52px;
        height: 100%;
        pointer-events: none;
        z-index: 4;
        background: linear-gradient(to right, var(--v-theme-background), rgba(0, 0, 0, 0));
      "
    ></div>
    <div
      v-if="store.providers.length && (model || 0) < store.providers.length - 1"
      class="position-absolute top-0 right-0"
      style="
        width: 52px;
        height: 100%;
        pointer-events: none;
        z-index: 4;
        background: linear-gradient(to left, var(--v-theme-background), rgba(0, 0, 0, 0));
      "
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
      class="position-absolute"
      style="
        top: 50%;
        left: 4px;
        transform: translateY(-50%);
        z-index: 5;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
      "
      @click="scrollPrev"
      icon="mdi-chevron-left"
    />
    <v-btn
      v-if="store.providers.length && (model || 0) < store.providers.length - 1"
      variant="flat"
      size="small"
      density="comfortable"
      class="position-absolute"
      style="
        top: 50%;
        right: 4px;
        transform: translateY(-50%);
        z-index: 5;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
      "
      @click="scrollNext"
      icon="mdi-chevron-right"
    />

    <v-slide-group
      v-model="model"
      class="pt-2 pb-4"
      selected-class="selected-chip"
      center-active
      @mousedown="firstInteract"
      @touchstart="firstInteract"
    >
      <v-slide-group-item
        v-for="(provider, i) in store.providers"
        :key="i"
        v-slot="{ toggle, isSelected }"
      >
        <v-hover v-slot="{ isHovering, props: hover }">
          <v-card
            v-bind="hover"
            class="mx-3 my-4 border-sm rounded-lg"
            :elevation="isSelected ? 6 : 2"
            :variant="isSelected ? 'outlined' : 'flat'"
            @click="(toggle(), firstInteract())"
            :style="[
              {
                width: '260px',
                minWidth: '260px',
                cursor: 'pointer',
                background:
                  'linear-gradient(135deg,var(--v-theme-surface) 0%,rgba(255,255,255,0.04) 100%)',
                transition: 'transform .28s cubic-bezier(.4,0,.2,1), box-shadow .28s',
                position: 'relative',
              },
              isHovering ? { transform: 'translateY(-4px)' } : null,
              isSelected
                ? {
                    outline: '2px solid var(--v-theme-primary)',
                    outlineOffset: '2px',
                    borderRadius: '14px',
                  }
                : null,
            ]"
          >
            <div class="d-flex align-center pa-3">
              <v-avatar
                size="70"
                class="me-4"
                rounded
                :style="{
                  background:
                    'radial-gradient(circle at 30% 30%,rgba(255,255,255,.35),rgba(255,255,255,.05))',
                  border: '1px solid rgba(var(--v-border-color),0.1)',
                  overflow: 'hidden',
                }"
              >
                <v-img :src="provider.logo" alt="logo" cover />
              </v-avatar>
              <div class="text-truncate">
                <h4 class="mb-1 text-subtitle-1 font-weight-medium text-truncate">
                  {{ provider.agency_name }}
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
                to="/rules"
              >
                View Rules
              </v-btn>
              <v-spacer />
            </div>
            <v-fade-transition> </v-fade-transition>
          </v-card>
        </v-hover>
      </v-slide-group-item>
    </v-slide-group>

    <div
      v-if="!store.providers.length"
      class="d-flex align-center justify-center position-absolute"
      style="inset: 0"
    >
      <v-progress-circular indeterminate color="primary" />
    </div>
  </div>
</template>
