import { defineConfig } from 'vitepress'
import { catalog } from './data/catalog'
import { ecosystem, siteMeta } from './data/ecosystem'

const sidebarZh = [
  {
    text: '开始',
    items: [
      { text: '阅读指南', link: '/start/' },
      { text: '生态全景：七块拼图', link: '/intro/#scope' },
    ],
  },
  ...catalog.map((c) => ({
    text: `${c.num} · ${c.zhTitle}`,
    link: `/${c.slug}/`,
    collapsed: true,
    items: [
      { text: '本章导语', link: `/${c.slug}/` },
      ...c.sections.map((s) => ({ text: s.zh, link: `/${c.slug}/#${s.id}` })),
    ],
  })),
  {
    text: '附录',
    items: [{ text: '参考来源与延伸阅读', link: '/reading/' }],
  },
]

const sidebarEn = [
  {
    text: 'Start here',
    items: [
      { text: 'How to read this', link: '/en/start/' },
      { text: 'The seven-piece map', link: '/en/intro/#scope' },
    ],
  },
  ...catalog.map((c) => ({
    text: `${c.num} · ${c.enTitle}`,
    link: `/en/${c.slug}/`,
    collapsed: true,
    items: [
      { text: 'Chapter intro', link: `/en/${c.slug}/` },
      ...c.sections.map((s) => ({ text: s.en, link: `/en/${c.slug}/#${s.id}` })),
    ],
  })),
  {
    text: 'Appendix',
    items: [{ text: 'Sources and further reading', link: '/en/reading/' }],
  },
]

const ecoNavZh = {
  text: '生态',
  items: ecosystem.map((e) => ({
    text: `${e.name} · ${e.zhRole}`,
    link: e.url,
  })),
}

const ecoNavEn = {
  text: 'Ecosystem',
  items: ecosystem.map((e) => ({
    text: `${e.name} · ${e.enRole}`,
    link: e.url,
  })),
}

const descriptionZh =
  'AI Agent 评估工程模式完全手册：评测数据集、四大评判器、轨迹评测、CI 门禁、A/B 实验与线上抽样，从原理到生产，中英双语。'
const descriptionEn =
  'The complete field guide to AI agent evaluation engineering: datasets, graders, trajectories, CI gates, A/B tests and online sampling.'

export default defineConfig({
  base: '/agent-evaluation-patterns/',
  lang: 'zh-CN',
  title: 'Agent 评测手册',
  description: descriptionZh,
  cleanUrls: false,
  lastUpdated: false,
  sitemap: {
    hostname: 'https://yuxinrun.github.io/agent-evaluation-patterns/',
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/agent-evaluation-patterns/favicon.svg' }],
    ['link', { rel: 'icon', href: '/agent-evaluation-patterns/favicon.ico', sizes: 'any' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/agent-evaluation-patterns/favicon-32.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/agent-evaluation-patterns/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#0a958a' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Agent 评测手册 · Agent Evaluation Patterns' }],
    ['meta', { property: 'og:description', content: descriptionEn }],
    ['meta', { property: 'og:url', content: 'https://yuxinrun.github.io/agent-evaluation-patterns/' }],
  ],
  markdown: {
    lineNumbers: true,
    // 代码块在明暗两种模式下都使用深色面板，因此统一采用深色 token，
    // 避免浅色模式出现「浅底主题色 + 深色背景」的低对比度问题。
    theme: { light: 'vitesse-dark', dark: 'vitesse-dark' },
    container: {
      tipLabel: '提示',
      warningLabel: '注意',
      dangerLabel: '危险',
      infoLabel: '说明',
      detailsLabel: '展开',
    },
  },
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'Agent 评测手册',
      description: descriptionZh,
      themeConfig: {
        nav: [
          { text: '阅读指南', link: '/start/' },
          {
            text: '章节',
            items: catalog.map((c) => ({ text: `${c.num} · ${c.zhTitle}`, link: `/${c.slug}/` })),
          },
          { text: '实战 Demo', link: '/demos/' },
          { text: '参考来源', link: '/reading/' },
          ecoNavZh,
        ],
        sidebar: sidebarZh,
        outline: { level: [2, 3], label: '本页目录' },
        docFooter: { prev: '上一章', next: '下一章' },
        lastUpdated: { text: '最后更新' },
        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        sidebarMenuLabel: '目录',
        returnToTopLabel: '回到顶部',
        langMenuLabel: '切换语言',
        externalLinkIcon: true,
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: 'Agent Evaluation Patterns',
      description: descriptionEn,
      themeConfig: {
        nav: [
          { text: 'How to read', link: '/en/start/' },
          {
            text: 'Chapters',
            items: catalog.map((c) => ({ text: `${c.num} · ${c.enTitle}`, link: `/en/${c.slug}/` })),
          },
          { text: 'Demos', link: '/en/demos/' },
          { text: 'Sources', link: '/en/reading/' },
          ecoNavEn,
        ],
        sidebar: sidebarEn,
        outline: { level: [2, 3], label: 'On this page' },
        docFooter: { prev: 'Previous', next: 'Next' },
        lastUpdated: { text: 'Last updated' },
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light theme',
        darkModeSwitchTitle: 'Switch to dark theme',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top',
        langMenuLabel: 'Change language',
        externalLinkIcon: true,
      },
    },
  },
  themeConfig: {
    logo: { src: '/logo.svg', alt: 'Agent Evaluation Patterns' },
    siteTitle: 'Agent Eval',
    socialLinks: [{ icon: 'github', link: siteMeta.repo }],
    footer: {
      message:
        '内容基于 Anthropic / OpenAI / LangChain 的评测实践与公开工程经验整理，示例仅用于教学。',
      copyright: `© ${new Date().getFullYear()} 鱼心 · Yuxin · MIT`,
    },
  },

  vite: {
    server: { port: 5183 },
  },
})
