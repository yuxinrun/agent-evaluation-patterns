import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import '@fontsource-variable/manrope'
import '@fontsource-variable/jetbrains-mono'
import './style.css'

import Layout from './Layout.vue'
import Diagram from './components/Diagram.vue'
import Eco from './components/Eco.vue'
import ChapterMap from './components/ChapterMap.vue'
import AuthorBrand from './components/AuthorBrand.vue'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('Diagram', Diagram)
    app.component('Eco', Eco)
    app.component('ChapterMap', ChapterMap)
    app.component('AuthorBrand', AuthorBrand)
  },
} satisfies Theme
