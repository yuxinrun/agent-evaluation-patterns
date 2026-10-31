<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { useLang } from '../composables/useLang'

const { t } = useLang()
const { page } = useData()
const visible = ref(false)
const progress = ref(0)

const onScroll = () => {
  visible.value = window.scrollY > 420
  const max = document.documentElement.scrollHeight - window.innerHeight
  progress.value = max > 0 ? Math.min(window.scrollY / max, 1) : 0
}
const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

// 切换页面后滚动位置会重置，进度条需要同步归零
watch(
  () => page.value.relativePath,
  () => requestAnimationFrame(onScroll),
)
</script>

<template>
  <div class="a-progress" :style="{ transform: `scaleX(${progress})` }"></div>
  <button
    class="a-top"
    :class="{ 'is-visible': visible }"
    type="button"
    :aria-label="t('回到顶部', 'Back to top')"
    :title="t('回到顶部', 'Back to top')"
    @click="toTop"
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
      <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>
