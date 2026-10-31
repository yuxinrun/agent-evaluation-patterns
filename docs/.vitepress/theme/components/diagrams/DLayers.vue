<script setup lang="ts">
defineProps<{
  layers: { t: string; items: string[]; tone?: string; note?: string }[]
}>()
</script>

<template>
  <div class="dg-layers">
    <div
      v-for="(l, i) in layers"
      :key="i"
      class="dg-layer"
      :class="l.tone ? `dg-tone-${l.tone}` : 'dg-tone-accent'"
    >
      <div class="dg-layer__t">{{ l.t }}</div>
      <div class="dg-layer__items">
        <span v-for="(item, j) in l.items" :key="j" class="dg-layer__item">{{ item }}</span>
      </div>
      <div v-if="l.note" class="dg-layer__note">{{ l.note }}</div>
    </div>
  </div>
</template>
