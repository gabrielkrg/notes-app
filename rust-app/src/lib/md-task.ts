import { joinNote, splitFrontmatter } from './md-wysiwyg.ts'

const TASK_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX~])\](?=\s|$)/

type MdNode = {
  type: string
  tagName?: string
  checked?: boolean | null
  value?: string
  children?: MdNode[]
  properties?: Record<string, unknown>
  data?: { hProperties?: Record<string, unknown> }
}

function walk(node: MdNode, visit: (node: MdNode) => void) {
  visit(node)
  if (!node.children) return
  for (const child of node.children) walk(child, visit)
}

function nextTaskMarker(marker: string): ' ' | 'x' {
  return marker.trim().toLowerCase() === 'x' ? ' ' : 'x'
}

function fenceOpen(line: string): { marker: string; len: number } | null {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
  if (!match) return null
  return { marker: match[1][0], len: match[1].length }
}

function fenceClose(line: string, marker: string, len: number): boolean {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/)
  return Boolean(match && match[1][0] === marker && match[1].length >= len)
}

export function toggleNthMdTask(markdown: string, index: number): string {
  const lines = String(markdown).split('\n')
  let inFence = false
  let fenceMarker = ''
  let fenceLen = 0
  let seen = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const open = fenceOpen(line)
    if (inFence) {
      if (fenceClose(line, fenceMarker, fenceLen)) {
        inFence = false
      }
      continue
    }
    if (open) {
      inFence = true
      fenceMarker = open.marker
      fenceLen = open.len
      continue
    }
    if (!TASK_RE.test(line)) continue
    if (seen !== index) {
      seen += 1
      continue
    }
    lines[i] = line.replace(TASK_RE, (_, prefix: string, marker: string) => `${prefix}[${nextTaskMarker(marker)}]`)
    return lines.join('\n')
  }

  return String(markdown)
}

export function toggleTaskInNote(raw: string, index: number): string {
  const { prefix, body } = splitFrontmatter(raw)
  return joinNote(prefix, toggleNthMdTask(body, index))
}

function stripPartialMarker(item: MdNode): boolean {
  if (typeof item.checked === 'boolean') return false
  const para = item.children?.find((child) => child.type === 'paragraph') ?? item.children?.[0]
  const first = para?.children?.[0]
  if (first?.type !== 'text' || first.value == null) return false
  if (!/^\[~\](?:\s|$)/.test(first.value)) return false
  first.value = first.value.replace(/^\[~\]\s?/, '')
  if (first.value === '') para?.children?.shift()
  item.checked = false
  item.data = item.data || {}
  item.data.hProperties = {
    ...item.data.hProperties,
    dataTaskState: 'partial',
  }
  return true
}

export function remarkPartialTasks() {
  return (tree: MdNode) => {
    walk(tree, (node) => {
      if (node.type === 'listItem') stripPartialMarker(node)
    })
  }
}

function ownCheckbox(li: MdNode): MdNode | undefined {
  for (const child of li.children || []) {
    if (child.tagName === 'input' && child.properties?.type === 'checkbox') return child
    if (child.tagName === 'p') {
      const inner = child.children?.find(
        (node) => node.tagName === 'input' && node.properties?.type === 'checkbox',
      )
      if (inner) return inner
    }
  }
}

function classList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean)
  return []
}

export function rehypeTaskIndexes() {
  return (tree: MdNode) => {
    let index = 0
    walk(tree, (node) => {
      if (node.tagName !== 'li') return
      if (!classList(node.properties?.className).includes('task-list-item')) return
      const box = ownCheckbox(node)
      if (!box) return
      box.properties = box.properties || {}
      box.properties.dataTaskIndex = index
      index += 1
      const state = node.properties?.dataTaskState
      if (state != null) box.properties.dataTaskState = state
    })
  }
}
