<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import { useLang } from '../composables/useLang'

interface DocEntry {
  u: string
  l: 'zh' | 'en'
  t: string
  h: string
  x: string
}

const { isEn, t } = useLang()
const open = ref(false)
const query = ref('')
const active = ref(0)
const loaded = ref(false)
const docs = ref<DocEntry[]>([])
const inputEl = ref<HTMLInputElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)

const load = async () => {
  if (loaded.value) return
  try {
    const res = await fetch(withBase('/search-index.json'))
    const json = await res.json()
    docs.value = json.docs ?? []
  } catch {
    docs.value = []
  } finally {
    loaded.value = true
  }
}

const splitTerms = (q: string) =>
  q
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

const results = computed(() => {
  const terms = splitTerms(query.value)
  const lang = isEn.value ? 'en' : 'zh'
  if (!terms.length) return []

  const scored: { doc: DocEntry; score: number; snippet: string }[] = []
  for (const doc of docs.value) {
    const title = doc.t.toLowerCase()
    const heading = doc.h.toLowerCase()
    const body = doc.x.toLowerCase()
    let score = 0
    let matchedAll = true
    for (const term of terms) {
      let hit = 0
      if (title.includes(term)) hit += 14
      if (heading.includes(term)) hit += 8
      if (body.includes(term)) hit += 4
      if (!hit) {
        matchedAll = false
        break
      }
      score += hit
    }
    if (!matchedAll) continue
    if (doc.l === lang) score += 6
    const idx = body.indexOf(terms[0])
    const start = Math.max(0, idx - 40)
    const snippet = (idx >= 0 ? doc.x.slice(start, start + 150) : doc.x.slice(0, 150)).trim()
    scored.push({ doc, score, snippet })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ doc, snippet }) => ({ ...doc, snippet }))
})

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const highlighted = (text: string) => {
  const terms = splitTerms(query.value)
  let out = escapeHtml(text)
  if (!terms.length) return out
  for (const term of terms) {
    const safe = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(safe, 'gi'), (m) => `<mark>${m}</mark>`)
  }
  return out
}

const navigate = (url: string) => {
  window.location.href = withBase(url)
  open.value = false
}

const onKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    toggle()
    return
  }
  if (!open.value) return
  if (e.key === 'Escape') {
    open.value = false
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = Math.min(active.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  } else if (e.key === 'Enter') {
    const hit = results.value[active.value]
    if (hit) navigate(hit.u)
  }
}

const toggle = () => {
  open.value = !open.value
  if (open.value) {
    load()
    nextTick(() => inputEl.value?.focus())
  } else {
    query.value = ''
  }
}

watch(query, () => {
  active.value = 0
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  // 空闲时预取索引，首次打开无等待
  const idle = (window as any).requestIdleCallback
  if (idle) idle(() => load())
  else setTimeout(load, 1500)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div>
    <button
      class="a-search__trigger"
      type="button"
      :aria-label="t('搜索文档', 'Search docs')"
      @click="toggle"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.6-3.6" stroke-linecap="round" />
      </svg>
      <span class="a-search__label">{{ t('搜索', 'Search') }}</span>
      <kbd>⌘K</kbd>
    </button>

    <Teleport to="body">
      <div v-if="open" class="a-modal" @click.self="open = false">
        <div ref="panelEl" class="a-modal__panel" role="dialog" aria-modal="true">
          <div class="a-modal__head">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color: var(--a-muted)">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" stroke-linecap="round" />
            </svg>
            <input
              ref="inputEl"
              v-model="query"
              class="a-modal__input"
              type="search"
              :placeholder="t('搜索章节、概念、模式…', 'Search chapters, concepts, patterns…')"
              autocomplete="off"
              spellcheck="false"
            />
            <span class="a-modal__esc">ESC</span>
          </div>
          <div class="a-modal__body">
            <div v-if="!query" class="a-modal__hint">
              <p v-if="!isEn">
                输入关键词，例如「黄金数据集」「轨迹评测」「LLM 裁判」「CI 门禁」「Kappa」。
                <br />
                共 {{ docs.length }} 个索引片段，支持中英文混合搜索。
              </p>
              <p v-else>
                Try “golden dataset”, “trajectory eval”, “LLM judge”, “CI gate” or “kappa”.
                <br />
                {{ docs.length }} indexed sections, bilingual search.
              </p>
            </div>
            <div v-else-if="!results.length" class="a-modal__hint">
              {{ t('没有找到结果，换个词试试。', 'No results. Try another keyword.') }}
            </div>
            <div v-else>
              <a
                v-for="(r, i) in results"
                :key="r.u + i"
                class="a-result"
                :class="{ 'is-active': i === active }"
                :href="withBase(r.u)"
                @mouseenter="active = i"
                @click.prevent="navigate(r.u)"
              >
                <div class="a-result__path">{{ r.l === 'en' ? 'EN' : '中' }} · {{ r.t }}</div>
                <div class="a-result__title" v-html="highlighted(r.h || r.t)"></div>
                <div class="a-result__snippet" v-html="highlighted(r.snippet)"></div>
              </a>
            </div>
          </div>
          <div class="a-modal__foot">
            <span>↑↓ {{ t('选择', 'navigate') }}</span>
            <span>↵ {{ t('打开', 'open') }}</span>
            <span>esc {{ t('关闭', 'close') }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
