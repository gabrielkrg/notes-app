import { storageKey } from './lib/config.ts'

const STORE_KEY = storageKey('annotations')

export type AnnotationType = 'highlight' | 'note'

export type Annotation = {
  id: string
  type: AnnotationType
  exact: string
  prefix: string
  suffix: string
  text: string
  createdAt: number
}

export type AnnotationQuote = Pick<Annotation, 'exact' | 'prefix' | 'suffix'>

type HastText = {
  type: 'text'
  value: string
}

type HastElement = {
  type: 'element'
  tagName: string
  properties?: {
    className?: string[]
    dataAnnId?: string
    dataAnnKind?: string
    dataAnnTip?: string
    [key: string]: unknown
  }
  children: HastNode[]
}

type HastParent = {
  type: string
  children?: HastNode[]
  properties?: HastElement['properties']
}

type HastNode = HastText | HastElement | HastParent

export function loadAnnotations(file: string): Annotation[] {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Record<string, unknown>
    return Array.isArray(all[file]) ? (all[file] as Annotation[]) : []
  } catch {
    return []
  }
}

export function saveAnnotations(file: string, list: Annotation[]): void {
  let all: Record<string, Annotation[]> = {}
  try {
    all = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Record<string, Annotation[]>
  } catch {
    all = {}
  }
  if (list.length) all[file] = list
  else delete all[file]
  localStorage.setItem(STORE_KEY, JSON.stringify(all))
}

export function newAnnotation(partial: Partial<Annotation> & AnnotationQuote): Annotation {
  return {
    id: crypto.randomUUID(),
    type: 'highlight',
    text: '',
    createdAt: Date.now(),
    ...partial,
  }
}

export function upsertAnnotation(list: Annotation[], annotation: Annotation): Annotation[] {
  const same = (item: Annotation) =>
    item.exact === annotation.exact &&
    item.prefix === annotation.prefix &&
    item.suffix === annotation.suffix
  const index = list.findIndex(same)
  if (index === -1) return [...list, annotation]
  const next = list.slice()
  next[index] = { ...list[index], ...annotation, id: list[index].id }
  return next
}

export function removeAnnotation(list: Annotation[], id: string): Annotation[] {
  return list.filter((item) => item.id !== id)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compact(value: string): string {
  return String(value || '').replace(/\s+/g, ' ')
}

function flexibleExact(exact: string): RegExp | null {
  const trimmed = compact(exact).trim()
  if (!trimmed) return null
  return new RegExp(escapeRegExp(trimmed).replace(/\s+/g, '\\s+'))
}

function locateQuote(haystack: string, annotation: Annotation): { start: number; end: number } | null {
  const pattern = flexibleExact(annotation.exact)
  if (!pattern) return null

  const prefix = compact(annotation.prefix).trim()
  const suffix = compact(annotation.suffix).trim()
  const global = new RegExp(pattern.source, 'g')
  let match: RegExpExecArray | null
  while ((match = global.exec(haystack))) {
    const before = compact(haystack.slice(0, match.index)).trimEnd()
    const after = compact(haystack.slice(match.index + match[0].length)).trimStart()
    const prefixOk = !prefix || before.endsWith(prefix)
    const suffixOk = !suffix || after.startsWith(suffix)
    if (prefixOk && suffixOk) {
      return { start: match.index, end: match.index + match[0].length }
    }
  }
  return null
}

function flattenText(node: HastNode | null | undefined, parent: HastParent | null, acc: { node: HastText; parent: HastParent | null }[]): void {
  if (!node) return
  if (node.type === 'text') {
    acc.push({ node: node as HastText, parent })
    return
  }
  if (node.type === 'element') {
    const tag = (node as HastElement).tagName
    if (tag === 'script' || tag === 'style') return
  }
  for (const child of 'children' in node && node.children ? node.children : []) flattenText(child, node, acc)
}

function wrapRange(
  flat: { node: HastText; parent: HastParent | null }[],
  range: { start: number; end: number },
  annotation: Annotation,
): void {
  const ops: {
    parent: HastParent
    node: HastText
    localStart: number
    localEnd: number
    isFirst: boolean
    isLast: boolean
  }[] = []
  let offset = 0

  for (const item of flat) {
    const len = item.node.value.length
    const nodeStart = offset
    const nodeEnd = offset + len
    offset = nodeEnd

    const from = Math.max(nodeStart, range.start)
    const to = Math.min(nodeEnd, range.end)
    if (from >= to || !item.parent?.children) continue
    if (item.parent.properties?.dataAnnId) continue

    ops.push({
      parent: item.parent,
      node: item.node,
      localStart: from - nodeStart,
      localEnd: to - nodeStart,
      isFirst: from === range.start,
      isLast: to === range.end,
    })
  }

  for (let i = ops.length - 1; i >= 0; i -= 1) {
    const op = ops[i]
    const value = op.node.value
    const before = value.slice(0, op.localStart)
    const mid = value.slice(op.localStart, op.localEnd)
    const after = value.slice(op.localEnd)
    if (!mid) continue

    const wrapped: HastElement = {
      type: 'element',
      tagName: 'span',
      properties: {
        className: ['ann', annotation.type === 'note' ? 'ann-note' : 'ann-mark'],
        dataAnnId: annotation.id,
        dataAnnKind: annotation.type,
        ...(op.isLast ? { dataAnnTip: '1' } : {}),
      },
      children: [{ type: 'text', value: mid }],
    }

    const parts: HastNode[] = []
    if (before) parts.push({ type: 'text', value: before })
    parts.push(wrapped)
    if (after) parts.push({ type: 'text', value: after })

    const index = op.parent.children!.indexOf(op.node)
    if (index === -1) continue
    op.parent.children!.splice(index, 1, ...parts)
  }
}

export function rehypeAnnotate(annotations: Annotation[] | null | undefined) {
  const list = (annotations || []).filter((item) => item?.exact)
  return (tree: HastParent) => {
    for (const annotation of list) {
      const flat: { node: HastText; parent: HastParent | null }[] = []
      flattenText(tree, null, flat)
      const haystack = flat.map((item) => item.node.value).join('')
      const range = locateQuote(haystack, annotation)
      if (!range) continue
      wrapRange(flat, range, annotation)
    }
  }
}

function textBefore(range: Range, size: number): string {
  const probe = document.createRange()
  const host = range.startContainer.ownerDocument?.body
  if (!host) return ''
  try {
    probe.selectNodeContents(host)
    probe.setEnd(range.startContainer, range.startOffset)
    return probe.toString().slice(-size)
  } catch {
    return ''
  }
}

function textAfter(range: Range, size: number): string {
  const probe = document.createRange()
  const host = range.endContainer.ownerDocument?.body
  if (!host) return ''
  try {
    probe.selectNodeContents(host)
    probe.setStart(range.endContainer, range.endOffset)
    return probe.toString().slice(0, size)
  } catch {
    return ''
  }
}

export function quoteFromRange(range: Range, root: Node): AnnotationQuote | null {
  const exact = range.toString()
  const trimmed = compact(exact).trim()
  if (!trimmed || trimmed.length > 400) return null

  const prefixRange = document.createRange()
  const suffixRange = document.createRange()
  try {
    prefixRange.setStart(root, 0)
    prefixRange.setEnd(range.startContainer, range.startOffset)
    suffixRange.setStart(range.endContainer, range.endOffset)
    suffixRange.setEnd(root, root.childNodes.length)
  } catch {
    return {
      exact: trimmed,
      prefix: compact(textBefore(range, 32)).slice(-32),
      suffix: compact(textAfter(range, 32)).slice(0, 32),
    }
  }

  return {
    exact: trimmed,
    prefix: compact(prefixRange.toString()).slice(-32),
    suffix: compact(suffixRange.toString()).slice(0, 32),
  }
}
