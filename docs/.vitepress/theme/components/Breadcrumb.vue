<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { catalog } from '../../data/catalog'
import { useLang } from '../composables/useLang'

const { page, frontmatter } = useData()
const { isEn, t } = useLang()

const chapter = computed(() => {
  const parts = page.value.relativePath.replace(/\.md$/, '').split('/')
  if (parts[parts.length - 1] === 'index') parts.pop()
  const slug = parts[parts.length - 1] ?? ''
  return catalog.find((c) => c.slug === slug)
})

const title = computed(() => frontmatter.value.breadcrumb || '')
</script>

<template>
  <nav v-if="chapter" class="a-breadcrumb" :aria-label="t('面包屑导航', 'Breadcrumb')">
    <a :href="withBase('/')">{{ t('首页', 'Home') }}</a>
    <span class="a-breadcrumb__sep">/</span>
    <a :href="withBase(isEn ? '/en/start/' : '/start/')">{{ t('手册', 'Handbook') }}</a>
    <span class="a-breadcrumb__sep">/</span>
    <span class="a-breadcrumb__chapter">{{ chapter.num }}</span>
    <span class="a-breadcrumb__sep">/</span>
    <span class="a-breadcrumb__now">{{ isEn ? chapter.enTitle : chapter.zhTitle }}</span>
    <template v-if="title">
      <span class="a-breadcrumb__sep">›</span>
      <span class="a-breadcrumb__now">{{ title }}</span>
    </template>
  </nav>
</template>
