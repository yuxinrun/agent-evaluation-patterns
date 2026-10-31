<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { useLang } from '../composables/useLang'

const { page } = useData()
const { isEn } = useLang()

/**
 * 语言切换保留当前页面：/intro/ ↔ /en/intro/
 * 而不是把读者丢回首页。
 */
const target = computed(() => {
  const path = page.value.relativePath.replace(/\.md$/, '').replace(/(^|\/)index$/, '')
  const slug = path.replace(/^en\//, '').replace(/^en$/, '')
  const prefix = isEn.value ? '' : 'en/'
  return `/${prefix}${slug ? `${slug}/` : ''}`
})
</script>

<template>
  <a
    class="a-lang"
    :href="withBase(target)"
    :aria-label="isEn ? '切换到中文' : 'Switch to English'"
    :title="isEn ? '切换到中文' : 'Switch to English'"
  >
    {{ isEn ? '中文' : 'EN' }}
  </a>
</template>
