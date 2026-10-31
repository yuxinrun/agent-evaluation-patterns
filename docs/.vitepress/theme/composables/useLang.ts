import { computed } from 'vue'
import { useData } from 'vitepress'

/**
 * 中英双语判定：英文站点全部位于 /en/ 下。
 * 组件内取百科文案、图解数据都用 t('中文', 'English')。
 */
export function useLang() {
  const { page } = useData()
  const isEn = computed(() => page.value.relativePath.startsWith('en/'))
  const lang = computed<'zh' | 'en'>(() => (isEn.value ? 'en' : 'zh'))
  const t = (zh: string, en: string) => (isEn.value ? en : zh)
  return { isEn, lang, t }
}
