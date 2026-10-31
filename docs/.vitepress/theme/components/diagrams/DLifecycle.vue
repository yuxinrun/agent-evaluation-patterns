<script setup lang="ts">
defineProps<{
  states: { t: string; s: string; tone?: string }[]
  note?: string
}>()
</script>

<template>
  <div>
    <div class="dg-life">
      <div
        v-for="(s, i) in states"
        :key="i"
        class="dg-life__state"
        :class="s.tone ? `dg-tone-${s.tone}` : 'dg-tone-accent'"
      >
        <div class="dg-life__t">{{ s.t }}</div>
        <div class="dg-life__s">{{ s.s }}</div>
      </div>
    </div>
    <div v-if="note" class="dg-life__note">{{ note }}</div>
  </div>
</template>
