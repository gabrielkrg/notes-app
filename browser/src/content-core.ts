export type FrontmatterValue = string | number | string[]
export type FrontmatterData = Record<string, FrontmatterValue>

export type NotePage = {
  file: string
  raw: string
  route: string
  title: string
  navLabel: string
  isIndex: boolean
  order: number
  focus: string
  cue: string[]
  body: string
  blurb: string
}

export type Pages = Record<string, NotePage>

export type NavPageNode = {
  type: 'page'
  id: string
  path: string
  label: string
  order: number
  page: NotePage
}

export type NavDirNode = {
  type: 'dir'
  id: string
  path: string
  label: string
  order: number
  focus?: string
  children: NavNode[]
  page?: NotePage
}

export type NavNode = NavPageNode | NavDirNode

export type Content = {
  pages: Pages
  navTree: NavNode[]
  topicPages: NotePage[]
  topicCount: number
}

export type MdHref =
  | { kind: 'external'; href: string }
  | { kind: 'hash'; href: string }
  | { kind: 'internal'; route: string; hash: string }

export type GraphNode = {
  id: string
  file: string
  route: string
  title: string
  group: string
}

export type GraphEdge = {
  source: string
  target: string
}

export type NoteGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

function unquote(value: string): string {
  const text = value.trim()
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1)
  }
  return text
}

export function parseFrontmatter(raw: string): { data: FrontmatterData; body: string } {
  const match = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: String(raw) }

  const data: FrontmatterData = {}
  let listKey: string | null = null
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) {
      listKey = null
      continue
    }
    const item = line.match(/^\s+-\s+(.*)$/)
    if (item && listKey) {
      const list = data[listKey]
      if (Array.isArray(list)) list.push(unquote(item[1]))
      continue
    }
    const pair = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/)
    if (!pair) continue
    const key = pair[1]
    const rest = pair[2]
    if (rest === '') {
      listKey = key
      data[key] = []
      continue
    }
    listKey = null
    const value = unquote(rest)
    data[key] = /^-?\d+$/.test(value) ? Number(value) : value
  }

  return { data, body: match[2] }
}

export function relFromVite(vitePath: string): string {
  const cleaned = String(vitePath).replace(/\\/g, '/').split('?')[0]
  const marker = '/notes/'
  const at = cleaned.lastIndexOf(marker)
  if (at !== -1) return cleaned.slice(at + marker.length)
  return cleaned
    .replace(/^\.\.\/\.\.\/notes\//, '')
    .replace(/^\.\.\/notes\//, '')
}

function fileKey(key: string): string {
  const cleaned = String(key).replace(/\\/g, '/').split('?')[0]
  if (cleaned.includes('/notes/') || cleaned.startsWith('../notes/') || cleaned.startsWith('../../notes/')) {
    return relFromVite(cleaned)
  }
  return cleaned.replace(/^\.\//, '')
}

function titleFrom(body: string, fallback: string): string {
  const match = body.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallback
}

function firstParagraph(body: string): string {
  for (const part of body.split(/\n\s*\n/)) {
    const trimmed = part.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---')) continue
    return trimmed.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  }
  return ''
}

export function routeFor(file: string): string {
  return String(file).replace(/\.(md|txt)$/i, '').replace(/\/index$/i, '')
}

function isIndexFile(file: string): boolean {
  return /(^|\/)index\.(md|txt)$/i.test(String(file))
}

function indexDirPath(file: string): string {
  if (/^index\.(md|txt)$/i.test(file)) return ''
  return file.replace(/\/index\.(md|txt)$/i, '')
}

function labelFromSlug(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function fmString(data: FrontmatterData, key: string): string {
  const value = data[key]
  return typeof value === 'string' ? value : ''
}

function buildPages(rawPages: Record<string, string>): Pages {
  const built: Pages = {}
  for (const [key, raw] of Object.entries(rawPages)) {
    const file = fileKey(key)
    const source = String(raw)
    const { data, body } = parseFrontmatter(source)
    built[file] = {
      file,
      raw: source,
      route: routeFor(file),
      title: fmString(data, 'title') || titleFrom(body, file),
      navLabel: fmString(data, 'nav') || fmString(data, 'title') || titleFrom(body, file),
      isIndex: isIndexFile(file),
      order: Number.isFinite(data.order) ? Number(data.order) : 99,
      focus: fmString(data, 'focus'),
      cue: Array.isArray(data.cue) ? data.cue.filter(Boolean) : [],
      body,
      blurb: fmString(data, 'focus') || firstParagraph(body),
    }
  }
  return built
}

function sortNodes(nodes: NavNode[]): void {
  nodes.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  for (const node of nodes) {
    if (node.type === 'dir' && node.children.length) sortNodes(node.children)
  }
}

function buildNavTree(pages: Pages): NavNode[] {
  const root: NavDirNode = { type: 'dir', id: '', path: '', label: 'Notes', order: 0, children: [] }
  const dirs = new Map<string, NavDirNode>([['', root]])

  function ensureDir(dirPath: string): NavDirNode {
    const existing = dirs.get(dirPath)
    if (existing) return existing
    const parts = dirPath.split('/')
    const parent = ensureDir(parts.slice(0, -1).join('/'))
    const slug = parts[parts.length - 1]
    const dir: NavDirNode = {
      type: 'dir',
      id: dirPath,
      path: dirPath,
      label: labelFromSlug(slug),
      order: 99,
      focus: '',
      children: [],
    }
    parent.children.push(dir)
    dirs.set(dirPath, dir)
    return dir
  }

  for (const page of Object.values(pages)) {
    if (page.isIndex) {
      const dirPath = indexDirPath(page.file)
      const dir = ensureDir(dirPath)
      dir.page = page
      dir.label = page.navLabel || page.title
      dir.order = page.order
      dir.focus = page.focus || page.blurb
      continue
    }

    const dirPath = page.file.includes('/')
      ? page.file.split('/').slice(0, -1).join('/')
      : ''
    const parent = ensureDir(dirPath)
    parent.children.push({
      type: 'page',
      id: page.file,
      path: page.route,
      label: page.navLabel || page.title,
      order: page.order,
      page,
    })
  }

  sortNodes(root.children)
  return root.children
}

export function buildContent(rawPages: Record<string, string> = {}): Content {
  const pages = buildPages(rawPages)
  const navTree = buildNavTree(pages)
  const topicPages = Object.values(pages).filter((page) => !page.isIndex)
  return {
    pages,
    navTree,
    topicPages,
    topicCount: topicPages.length,
  }
}

export function pageByRoute(pages: Pages, route: string): NotePage | null {
  if (!route) return null
  const direct = Object.values(pages).find((page) => page.route === route)
  if (direct) return direct
  return pages[`${route}/index.md`] ?? pages[`${route}/index.txt`] ?? null
}

export function flattenPages(nodes: NavNode[] = []): NotePage[] {
  const out: NotePage[] = []
  for (const node of nodes) {
    if (node.type === 'dir') {
      if (node.page) out.push(node.page)
      out.push(...flattenPages(node.children))
    } else if (node.page) {
      out.push(node.page)
    }
  }
  return out
}

export function countTopicPages(node: NavNode): number {
  if (node.type === 'page') return 1
  return node.children.reduce((sum, child) => sum + countTopicPages(child), 0)
}

export function neighbors(navTree: NavNode[], route: string): { prev: NotePage | null; next: NotePage | null } {
  const flat = flattenPages(navTree)
  const idx = flat.findIndex((page) => page.route === route)
  if (idx === -1) return { prev: null, next: null }
  return {
    prev: flat[idx - 1] ?? null,
    next: flat[idx + 1] ?? null,
  }
}

export function crumbsForRoute(navTree: NavNode[], route: string): NavNode[] {
  if (!route) return []

  function walk(nodes: NavNode[], acc: NavNode[]): NavNode[] | null {
    for (const node of nodes) {
      const next = [...acc, node]
      if (node.type === 'dir') {
        if (node.path === route || node.page?.route === route) return next
        const found = walk(node.children, next)
        if (found) return found
      } else if (node.path === route || node.page?.route === route) {
        return next
      }
    }
    return null
  }

  return walk(navTree, []) || []
}

export function sectionForRoute(navTree: NavNode[], route: string): { id: string; label: string; path: string } | null {
  const dir = crumbsForRoute(navTree, route).find((node): node is NavDirNode => node.type === 'dir')
  if (!dir) return null
  return { id: dir.id, label: dir.label, path: dir.path }
}

export function dirForIndex(navTree: NavNode[], page: NotePage | null | undefined): NavDirNode | null {
  if (!page?.isIndex) return null
  const indexPage = page

  function walk(nodes: NavNode[] | undefined): NavDirNode | null {
    for (const node of nodes || []) {
      if (node.type !== 'dir') continue
      if (node.page?.file === indexPage.file) return node
      const found = walk(node.children)
      if (found) return found
    }
    return null
  }

  return walk(navTree)
}

export function firstPageRoute(node: NavNode): string {
  if (node.type === 'page') return node.page?.route || node.path
  if (node.page) return node.page.route
  for (const child of node.children) {
    const found = firstPageRoute(child)
    if (found) return found
  }
  return ''
}

export function filterTree(nodes: NavNode[], query: string): NavNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes

  function matches(node: NavNode): boolean {
    const hay = `${node.label} ${node.type === 'dir' ? node.focus || '' : ''} ${node.page?.title || ''} ${node.page?.navLabel || ''}`.toLowerCase()
    return hay.includes(q)
  }

  function filter(list: NavNode[]): NavNode[] {
    const out: NavNode[] = []
    for (const node of list) {
      if (node.type === 'page') {
        if (matches(node)) out.push(node)
        continue
      }
      const kids = filter(node.children)
      if (matches(node) || kids.length) {
        out.push({ ...node, children: matches(node) ? node.children : kids })
      }
    }
    return out
  }

  return filter(nodes)
}

export function resolveMdHref(fromFile: string, href: string): MdHref {
  if (!href) return { kind: 'external', href: '#' }
  if (/^(https?:|mailto:)/.test(href)) return { kind: 'external', href }
  if (href.startsWith('#')) return { kind: 'hash', href }

  const [pathPart, hash] = href.split('#')
  if (!/\.(md|txt)$/i.test(pathPart)) return { kind: 'external', href }

  const fromDir = fromFile.split('/').slice(0, -1).join('/')
  const normalized = new URL(pathPart, `https://notes.local/${fromDir}/`).pathname.replace(/^\//, '')
  return { kind: 'internal', route: routeFor(normalized), hash: hash ? `#${hash}` : '' }
}

export const GRAPH_ROUTE = 'graph'

export function isGraphRoute(route: string): boolean {
  return route === GRAPH_ROUTE
}

function topLevelGroup(file: string): string {
  const parts = String(file).split('/')
  return parts.length > 1 ? parts[0] : ''
}

const MD_LINK = /(?<!!)\[(?:[^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

function extractMdHrefs(body: string): string[] {
  return [...String(body).matchAll(MD_LINK)].map((match) => match[1])
}

export function buildNoteGraph(pages: Pages = {}): NoteGraph {
  const list = Object.values(pages)
  const byRoute = new Map(list.map((page) => [page.route, page]))
  const nodes = list.map((page) => ({
    id: page.file,
    file: page.file,
    route: page.route,
    title: page.navLabel || page.title,
    group: topLevelGroup(page.file),
  }))

  const seen = new Set<string>()
  const edges: GraphEdge[] = []
  for (const page of list) {
    for (const href of extractMdHrefs(page.body)) {
      const target = resolveMdHref(page.file, href)
      if (target.kind !== 'internal') continue
      const dest = byRoute.get(target.route)
      if (!dest || dest.file === page.file) continue
      const key = `${page.file}\0${dest.file}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ source: page.file, target: dest.file })
    }
  }

  return { nodes, edges }
}

export function groupLinkCounts(graph: NoteGraph): Map<string, number> {
  const groupOf = new Map((graph.nodes || []).map((node) => [node.id, node.group]))
  const counts = new Map<string, number>()
  for (const node of graph.nodes || []) {
    if (!counts.has(node.group)) counts.set(node.group, 0)
  }
  for (const edge of graph.edges || []) {
    const sourceGroup = groupOf.get(edge.source)
    const targetGroup = groupOf.get(edge.target)
    if (sourceGroup === targetGroup) {
      counts.set(sourceGroup ?? '', (counts.get(sourceGroup ?? '') || 0) + 1)
      continue
    }
    if (sourceGroup !== undefined) counts.set(sourceGroup, (counts.get(sourceGroup) || 0) + 1)
    if (targetGroup !== undefined) counts.set(targetGroup, (counts.get(targetGroup) || 0) + 1)
  }
  return counts
}
