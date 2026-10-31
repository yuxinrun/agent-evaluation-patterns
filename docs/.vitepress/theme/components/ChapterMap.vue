<script setup lang="ts">
import { withBase } from 'vitepress'
import { catalog } from '../../data/catalog'
import { useLang } from '../composables/useLang'

const props = defineProps<{ limit?: number }>()
const { isEn, t } = useLang()

const items = catalog.slice(0, props.limit ?? catalog.length)
const href = (slug: string) => withBase(isEn.value ? `/en/${slug}/` : `/${slug}/`)
</script>

<template>
  <div class="a-map">
    <a v-for="c in items" :key="c.slug" class="a-map__item" :href="href(c.slug)">
      <span class="a-map__num">{{ c.num }}</span>
      <span class="a-map__title">{{ isEn ? c.enTitle : c.zhTitle }}</span>
      <span class="a-map__lead">{{ isEn ? c.enLead : c.zhLead }}</span>
      <span class="a-map__tag">{{ isEn ? c.enTag : c.zhTag }}</span>
    </a>
  </div>
</template>
