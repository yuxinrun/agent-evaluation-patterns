<script setup lang="ts">
defineProps<{
  left: { title: string; sub: string; points: string[] }
  right: { title: string; sub: string; points: string[] }
  axis?: string
}>()
</script>

<template>
  <div class="dg-compare">
    <div class="dg-compare__panel dg-compare__panel--left">
      <div class="dg-compare__title">{{ left.title }}</div>
      <div class="dg-compare__sub">{{ left.sub }}</div>
      <ul class="dg-compare__points">
        <li v-for="(p, i) in left.points" :key="i">{{ p }}</li>
      </ul>
    </div>
    <div v-if="axis" class="dg-compare__axis">{{ axis }}</div>
    <div class="dg-compare__panel dg-compare__panel--right">
      <div class="dg-compare__title">{{ right.title }}</div>
      <div class="dg-compare__sub">{{ right.sub }}</div>
      <ul class="dg-compare__points">
        <li v-for="(p, i) in right.points" :key="i">{{ p }}</li>
      </ul>
    </div>
  </div>
</template>
