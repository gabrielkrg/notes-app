export const CONTENT_SEARCH_MIN_LENGTH = 2
export const CONTENT_SEARCH_LIMIT = 30
export const CONTENT_SEARCH_DEBOUNCE_MS = 250

const SNIPPET_RADIUS = 42

export type SearchableNote = {
  file: string
  route: string
  title: string
  navLabel?: string
  body: string
}

export type ContentHit = {
  file: string
  route: string
  title: string
  snippet: string
}

export function shouldSearchContent(query: string): boolean {
  return String(query || '').trim().length >= CONTENT_SEARCH_MIN_LENGTH
}

export function matchesNoteMeta(note: SearchableNote, query: string): boolean {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return true
  return [note.title, note.navLabel, note.route, note.file].some((part) =>
    String(part || '').toLowerCase().includes(needle),
  )
}

function snippetAround(text: string, start: number, length: number): string {
  const from = Math.max(0, start - SNIPPET_RADIUS)
  const to = Math.min(text.length, start + length + SNIPPET_RADIUS)
  let snippet = text.slice(from, to).replace(/\s+/g, ' ').trim()
  if (from > 0) snippet = `…${snippet}`
  if (to < text.length) snippet = `${snippet}…`
  return snippet
}

export function searchNoteContents(
  notes: SearchableNote[],
  query: string,
  options: { limit?: number } = {},
): ContentHit[] {
  if (!shouldSearchContent(query)) return []
  const needle = String(query).trim()
  const lower = needle.toLowerCase()
  const limit = options.limit ?? CONTENT_SEARCH_LIMIT
  const hits: ContentHit[] = []
  for (const note of notes) {
    const body = String(note.body || '')
    const at = body.toLowerCase().indexOf(lower)
    if (at === -1) continue
    hits.push({
      file: note.file,
      route: note.route,
      title: note.navLabel || note.title,
      snippet: snippetAround(body, at, needle.length),
    })
    if (hits.length >= limit) break
  }
  return hits
}
