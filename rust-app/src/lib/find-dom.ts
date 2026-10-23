import type { TextMatch } from './find-in-page.ts'

export const FIND_HIGHLIGHT = 'notes-find'

export type RevealOptions = {
  focus?: boolean
}

type HighlightStore = {
  set: (name: string, value: object) => void
  delete: (name: string) => void
}

function highlightStore(doc?: Document): HighlightStore | null {
  const view = (doc || globalThis.document)?.defaultView
  const css = view?.CSS as { highlights?: HighlightStore } | undefined
  return css?.highlights || null
}

function HighlightCtor(doc?: Document): (new (range: Range) => object) | null {
  const view = (doc || globalThis.document)?.defaultView as { Highlight?: new (range: Range) => object } | null
  return view?.Highlight || null
}

export function clearFindHighlight(doc: Document = document): void {
  highlightStore(doc)?.delete(FIND_HIGHLIGHT)
}

export function highlightRange(range: Range): boolean {
  const doc = range.startContainer.ownerDocument || document
  const Highlight = HighlightCtor(doc)
  const store = highlightStore(doc)
  if (!Highlight || !store) return false
  store.set(FIND_HIGHLIGHT, new Highlight(range))
  return true
}

export function collectText(root: HTMLElement): string {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let out = ''
  let node: Node | null
  while ((node = walker.nextNode())) out += node.nodeValue || ''
  return out
}

export function rangeFromOffsets(root: HTMLElement, start: number, end: number): Range | null {
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let offset = 0
  let startNode: Text | null = null
  let startOff = 0
  let endNode: Text | null = null
  let endOff = 0
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const len = node.data.length
    if (!startNode && start <= offset + len) {
      startNode = node
      startOff = Math.max(0, start - offset)
    }
    if (end <= offset + len) {
      endNode = node
      endOff = Math.max(0, end - offset)
      break
    }
    offset += len
  }
  if (!startNode || !endNode) return null
  const range = doc.createRange()
  range.setStart(startNode, Math.min(startOff, startNode.data.length))
  range.setEnd(endNode, Math.min(endOff, endNode.data.length))
  return range
}

export function revealInElement(root: HTMLElement, match: TextMatch, options: RevealOptions = {}): void {
  const range = rangeFromOffsets(root, match.start, match.end)
  if (!range) return
  highlightRange(range)
  if (options.focus) {
    const sel = root.ownerDocument.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
  const mark = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement
  mark?.scrollIntoView({ block: 'center', inline: 'nearest' })
}

export function revealInTextarea(
  el: HTMLTextAreaElement,
  match: TextMatch,
  scroller?: HTMLElement,
  options: RevealOptions = {},
): void {
  if (options.focus) el.setSelectionRange(match.start, match.end)
  const host = scroller || el
  const before = el.value.slice(0, match.start)
  const line = before.split('\n').length - 1
  const cs = el.ownerDocument.defaultView?.getComputedStyle(el)
  const fontSize = Number.parseFloat(cs?.fontSize || '') || 16
  const lineHeight = Number.parseFloat(cs?.lineHeight || '') || fontSize * 1.5
  const pad = Number.parseFloat(cs?.paddingTop || '') || 0
  host.scrollTop = Math.max(0, line * lineHeight + pad - host.clientHeight / 3)
}

export function clearElementSelection(root: HTMLElement | null): void {
  if (!root) return
  root.ownerDocument.getSelection()?.removeAllRanges()
}
