<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  actors: string[]
  steps: { from: number; to: number; t: string; dashed?: boolean }[]
}>()

const cols = computed(() => ({ '--dg-cols': props.actors.length }) as Record<string, string>)

/** 用百分比定位，让箭头严格对齐角色泳道 */
const place = (step: { from: number; to: number }) => {
  const n = props.actors.length
  const lo = Math.min(step.from, step.to)
  const hi = Math.max(step.from, step.to)
  return {
    left: `${((lo - 1) / n) * 100}%`,
    width: `${((hi - lo + 1) / n) * 100}%`,
  }
}
</script>

<template>
  <div class="dg-seq" :style="cols">
    <div class="dg-seq__actors">
      <div v-for="(a, i) in actors" :key="i" class="dg-seq__actor">{{ a }}</div>
    </div>
    <div class="dg-seq__body">
      <div class="dg-seq__lines">
        <span v-for="(a, i) in actors" :key="i"></span>
      </div>
      <div v-for="(s, i) in steps" :key="i" class="dg-seq__row">
        <div class="dg-seq__move" :style="place(s)">
          <div class="dg-seq__msg">{{ s.t }}</div>
          <div
            v-if="s.from !== s.to"
            class="dg-seq__arrow"
            :class="{ 'is-back': s.to < s.from, 'is-dashed': s.dashed }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>
