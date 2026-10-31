<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  center: string
  nodes: string[]
  mode?: 'star' | 'broadcast' | 'cycle'
  note?: string
}>()

/** 环形布局：从正上方开始顺时针均匀分布 */
const placed = computed(() =>
  props.nodes.map((label, i) => {
    const angle = (-90 + (360 / props.nodes.length) * i) * (Math.PI / 180)
    return {
      label,
      x: 50 + Math.cos(angle) * 37,
      y: 50 + Math.sin(angle) * 34,
    }
  }),
)
</script>

<template>
  <div>
    <div class="dg-hub">
      <div class="dg-hub__ring"></div>
      <div class="dg-hub__center">{{ center }}</div>
      <div
        v-for="(n, i) in placed"
        :key="i"
        class="dg-hub__node"
        :style="{ left: `${n.x}%`, top: `${n.y}%` }"
      >
        {{ n.label }}
      </div>
    </div>
    <div v-if="note" class="dg-hub__note">{{ note }}</div>
  </div>
</template>
