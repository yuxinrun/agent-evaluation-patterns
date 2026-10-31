<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Breadcrumb from './components/Breadcrumb.vue'
import BackToTop from './components/BackToTop.vue'
import DocFooter from './components/DocFooter.vue'
import LangSwitch from './components/LangSwitch.vue'
import SearchBox from './components/SearchBox.vue'
import SidebarEco from './components/SidebarEco.vue'

const { Layout } = DefaultTheme
const { page } = useData()

/** 入场动效目标：只包住不会发生 hover 位移的容器，避免和卡片 hover 冲突 */
const TARGETS = [
  '.a-section__head',
  '.a-eco__card',
  '.a-map__item',
  '.a-path',
  '.a-diagram',
  '.a-board__card',
  '.a-src',
  '.vp-doc > h2',
  '.vp-doc > h3',
  '.vp-doc .custom-block',
  '.vp-doc > table',
  ".vp-doc > div[class*='language-']",
].join(',')

/** 这些元素自身有 hover 位移，只做淡入，不做位移 */
const FADE_ONLY = '.a-eco__card,.a-map__item,.a-path,.a-board__card'

let observer: IntersectionObserver | null = null

const reveal = (el: HTMLElement) => {
  if (el.classList.contains('is-in')) return
  el.classList.add('is-in')
  observer?.unobserve(el)
  // 入场动画结束后移除标记，让元素恢复自身的 hover 过渡
  const delay = Number(el.style.getPropertyValue('--reveal-delay').replace('ms', '')) || 0
  window.setTimeout(() => el.removeAttribute('data-reveal'), 700 + delay)
}

/** 兼容隐藏标签页 / 观察器不回调的情况：直接按可视区补揭示 */
const revealInView = () => {
  const viewport = window.innerHeight || 800
  document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)').forEach((el) => {
    const rect = el.getBoundingClientRect()
    // 已进入或已经越过视口的元素都算迟到，一并揭示，避免快速滚动/锚点跳转后留下空白
    if (window.innerHeight === 0 || rect.top < viewport * 0.96) reveal(el)
  })
}

let lastRevealCheck = 0
const onScroll = () => {
  const now = Date.now()
  if (now - lastRevealCheck < 120) return
  lastRevealCheck = now
  revealInView()
}

const setup = () => {
  if (typeof window === 'undefined') return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || !('IntersectionObserver' in window)) return

  document.documentElement.classList.add('has-motion')
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) reveal(entry.target as HTMLElement)
      })
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
  )

  document.querySelectorAll<HTMLElement>(TARGETS).forEach((el) => {
    if (!el.hasAttribute('data-reveal')) {
      el.dataset.reveal = el.matches(FADE_ONLY) ? 'fade' : ''
      const siblings = Array.from(el.parentElement?.children ?? []).filter((node) =>
        node.matches(TARGETS),
      )
      const index = siblings.indexOf(el)
      el.style.setProperty('--reveal-delay', `${Math.min(Math.max(index, 0), 6) * 70}ms`)
    }
    // 路由切换重建 observer 后，未揭示的元素需要重新挂上
    if (!el.classList.contains('is-in')) observer?.observe(el)
  })

  window.setTimeout(revealInView, 600)
  window.setTimeout(revealInView, 1600)
}

onMounted(() => {
  nextTick(setup)
  window.setTimeout(setup, 260)
  window.addEventListener('scroll', onScroll, { passive: true })
})

watch(
  () => page.value.relativePath,
  async () => {
    await nextTick()
    setup()
    window.setTimeout(setup, 180)
  },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <Layout>
    <template #nav-bar-content-after>
      <div class="a-nav-actions">
        <LangSwitch />
        <SearchBox />
      </div>
    </template>
    <template #doc-before>
      <Breadcrumb />
    </template>
    <template #doc-after>
      <DocFooter />
    </template>
    <template #sidebar-nav-after>
      <SidebarEco />
    </template>
    <template #layout-bottom>
      <BackToTop />
    </template>
  </Layout>
</template>
