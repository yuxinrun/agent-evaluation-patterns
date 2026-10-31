/**
 * 站内搜索索引构建：把 Markdown 切成「小节」，供自定义搜索框做中英文混合匹配。
 * 不依赖任何第三方搜索服务，产物是 public/search-index.json。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')
const outFile = path.join(docsDir, 'public', 'search-index.json')

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'public' || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (entry.name.endsWith('.md')) files.push(full)
  }
  return files
}

const slugify = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')

const toPlain = (markdown) =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, (row) => row.replace(/\|/g, ' '))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/:::[a-z-]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const routeOf = (relative) => {
  if (relative === 'index.md') return '/'
  if (relative.endsWith('/index.md')) return `/${relative.slice(0, -'index.md'.length)}`
  return `/${relative.replace(/\.md$/, '')}`
}

const build = async () => {
  const files = await walk(docsDir)
  const docs = []
  const seen = new Set()

  for (const file of files) {
    const relative = path.relative(docsDir, file).split(path.sep).join('/')
    const raw = await fs.readFile(file, 'utf8')
    const lang = relative.startsWith('en/') ? 'en' : 'zh'
    const route = routeOf(relative)
    if (route.includes('404')) continue // 404 页不进搜索（keep error pages out of the index）

    const fmTitle = raw.match(/^---[\s\S]*?^title:\s*(.+)$/m)?.[1]?.replace(/['"]/g, '').trim()
    const h1 = raw.match(/^#\s+(.+)$/m)?.[1]?.trim()
    const pageTitle = (h1 || fmTitle || relative).replace(/\s*\{#[^}]*\}\s*/g, '')

    // 去掉 frontmatter，避免标题与描述被当成正文索引
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    const lines = body.split(/\r?\n/)
    let heading = pageTitle
    let anchor = ''
    let buffer = []
    let inFence = false

    const flush = () => {
      const text = toPlain(buffer.join('\n')).slice(0, 900)
      buffer = []
      if (text.length <= 24) return
      const url = `${route}${anchor ? `#${anchor}` : ''}`
      if (seen.has(url)) return
      seen.add(url)
      docs.push({
        u: url,
        l: lang,
        t: pageTitle.slice(0, 80),
        h: heading.slice(0, 90),
        x: text,
      })
    }

    for (const line of lines) {
      if (/^\s*```/.test(line)) inFence = !inFence
      const m = inFence ? null : line.match(/^(#{1,3})\s+(.*)$/)
      if (m) {
        flush()
        const title = m[2].trim()
        const explicit = title.match(/\{#([^}]+)\}\s*$/)
        anchor = explicit ? explicit[1] : m[1].length > 1 ? slugify(title.replace(/\{#([^}]+)\}\s*$/, '')) : ''
        heading = title.replace(/\s*\{#[^}]*\}\s*$/, '')
        if (m[1].length === 1) anchor = ''
        continue
      }
      buffer.push(line)
    }
    flush()
  }

  await fs.mkdir(path.dirname(outFile), { recursive: true })
  await fs.writeFile(outFile, JSON.stringify({ generated: new Date().toISOString(), docs }), 'utf8')
  const kb = (JSON.stringify(docs).length / 1024).toFixed(0)
  console.log(`[search] ${docs.length} sections -> docs/public/search-index.json (${kb} KB)`)
}

build().catch((error) => {
  console.error('[search] failed', error)
  process.exit(1)
})
