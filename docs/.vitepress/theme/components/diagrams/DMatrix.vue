<script setup lang="ts">
defineProps<{
  head: string[]
  rows: string[][]
  highlight?: number[]
}>()
</script>

<template>
  <div class="dg-matrix__scroll">
    <table class="dg-matrix">
      <thead>
        <tr>
          <th v-for="(h, i) in head" :key="i">{{ h }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, i) in rows"
          :key="i"
          :class="{ 'is-mark': highlight?.includes(i) }"
        >
          <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
