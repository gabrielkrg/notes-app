export type TextMatch = {
  start: number
  end: number
}

export type FindResult = {
  count: number
  index: number
}

export function findMatches(haystack: string, query: string): TextMatch[] {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return []
  const text = String(haystack || '').toLowerCase()
  const matches: TextMatch[] = []
  let from = 0
  while (from <= text.length - needle.length) {
    const start = text.indexOf(needle, from)
    if (start === -1) break
    matches.push({ start, end: start + needle.length })
    from = start + 1
  }
  return matches
}

export function wrapIndex(index: number, count: number): number {
  if (count <= 0) return -1
  return ((index % count) + count) % count
}

export function stepFindIndex(current: number, direction: 1 | -1, alreadyRevealed: boolean): number {
  if (!alreadyRevealed) return current < 0 ? 0 : current
  return current + direction
}

export function isFindShortcut(event: {
  key?: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}): boolean {
  if (event.shiftKey || event.altKey) return false
  const mod = Boolean(event.metaKey || event.ctrlKey)
  return mod && String(event.key || '').toLowerCase() === 'f'
}

export function isFindNextShortcut(event: { key?: string; shiftKey?: boolean }): boolean {
  return event.key === 'F3' && !event.shiftKey
}

export function isFindPrevShortcut(event: { key?: string; shiftKey?: boolean }): boolean {
  return event.key === 'F3' && Boolean(event.shiftKey)
}

export function runFind(haystack: string, query: string, index: number): { matches: TextMatch[] } & FindResult {
  const matches = findMatches(haystack, query)
  const active = wrapIndex(index, matches.length)
  return { matches, count: matches.length, index: active }
}
