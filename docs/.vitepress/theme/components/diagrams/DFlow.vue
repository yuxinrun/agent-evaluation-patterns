<script setup lang="ts">
defineProps<{
  nodes: { t: string; s?: string; tone?: string }[]
  edges?: string[]
  dir?: 'h' | 'v'
}>()
</script>

<template>
  <div class="dg-flow" :class="{ 'dg-flow--v': dir === 'v' }">
    <template v-for="(n, i) in nodes" :key="i">
      <div class="dg-node" :class="n.tone ? `dg-tone-${n.tone}` : 'dg-tone-accent'">
        <span class="dg-node__t">{{ n.t }}</span>
        <span v-if="n.s" class="dg-node__s">{{ n.s }}</span>
      </div>
      <div v-if="i < nodes.length - 1" class="dg-edge">
        <span v-if="edges && edges[i]" class="dg-edge__label">{{ edges[i] }}</span>
      </div>
    </template>
  </div>
</template>
