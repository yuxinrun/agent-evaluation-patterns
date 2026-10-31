<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { catalog, chapterPath, neighbors } from '../../data/catalog'
import { ecosystem, siteMeta } from '../../data/ecosystem'
import { useLang } from '../composables/useLang'

const { page } = useData()
const { isEn, t } = useLang()

const lang = computed(() => (isEn.value ? 'en' : 'zh'))

const current = computed(() => {
  const parts = page.value.relativePath.replace(/\.md$/, '').split('/')
  if (parts[parts.length - 1] === 'index') parts.pop()
  return catalog.find((c) => c.slug === parts[parts.length - 1])
})

const nav = computed(() =>
  current.value ? neighbors(current.value.slug) : { prev: undefined, next: undefined },
)

const href = (slug: string) => withBase(chapterPath(catalog.find((c) => c.slug === slug)!, lang.value))
const label = (item: { num: string; zhTitle: string; enTitle: string }) =>
  `${item.num} · ${isEn.value ? item.enTitle : item.zhTitle}`
</script>

<template>
  <footer class="a-docfoot">
    <nav v-if="current" class="a-docfoot__nav" :aria-label="t('章节导航', 'Chapter navigation')">
      <a v-if="nav.prev" class="a-docfoot__pager is-prev" :href="href(nav.prev.slug)">
        <span class="a-docfoot__dir">{{ t('← 上一章', '← Previous') }}</span>
        <span class="a-docfoot__chapter">{{ label(nav.prev) }}</span>
      </a>
      <a v-if="nav.next" class="a-docfoot__pager is-next" :href="href(nav.next.slug)">
        <span class="a-docfoot__dir">{{ t('下一章 →', 'Next →') }}</span>
        <span class="a-docfoot__chapter">{{ label(nav.next) }}</span>
      </a>
    </nav>

    <div class="a-docfoot__label">{{ t('继续在生态里逛', 'Keep exploring the ecosystem') }}</div>
    <div class="a-docfoot__grid">
      <a
        v-for="item in ecosystem"
        :key="item.key"
        class="a-docfoot__card"
        :class="{ 'is-current': item.current }"
        :href="item.url"
        :target="item.current ? undefined : '_blank'"
        rel="noreferrer"
      >
        <span class="a-docfoot__name">{{ item.name }}</span>
        <span class="a-docfoot__role">{{ t(item.zhRole, item.enRole) }}</span>
      </a>
    </div>
    <div class="a-docfoot__meta">
      <a :href="siteMeta.authorUrl" target="_blank" rel="noreferrer">{{ t('鱼心快跑', '鱼心快跑 · Yuxin') }}</a>
      <span>·</span>
      <span>{{ t('内容基于 Anthropic / OpenAI / LangChain 评测实践与公开工程经验整理', 'Built on Anthropic, OpenAI and LangChain eval practice plus public engineering experience') }}</span>
      <span>·</span>
      <a :href="siteMeta.repo" target="_blank" rel="noreferrer">{{ t('仓库', 'Repository') }}</a>
      <span>·</span>
      <span>{{ siteMeta.license }}</span>
    </div>
  </footer>
</template>
