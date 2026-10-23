import { storageKey } from './config.ts'

export const BOOKMARK_STORAGE_KEY = storageKey('bookmarks')

export type BookmarkPage = {
  file: string
  title: string
  route: string
}

export type BookmarkEntry = {
  file: string
  title: string
  route: string | null
}

export function parseBookmarks(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const files: string[] = []
  for (const item of value) {
    const file = String(item || '').trim()
    if (!file || seen.has(file)) continue
    seen.add(file)
    files.push(file)
  }
  return files
}

export function toggleBookmark(files: unknown, file: string): string[] {
  const path = String(file || '').trim()
  const current = parseBookmarks(files)
  if (!path) return current
  return current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
}

export function bookmarkEntries(
  files: unknown,
  pages: Record<string, BookmarkPage>,
): BookmarkEntry[] {
  const byFile = new Map(Object.values(pages).map((page) => [page.file, page]))
  return parseBookmarks(files).map((file) => {
    const page = byFile.get(file)
    return {
      file,
      title: page?.title || file,
      route: page?.route ?? null,
    }
  })
}

export function readBookmarks(): string[] {
  try {
    return parseBookmarks(JSON.parse(localStorage.getItem(BOOKMARK_STORAGE_KEY) || '[]'))
  } catch {
    return []
  }
}

export function persistBookmarks(files: unknown): string[] {
  const next = parseBookmarks(files)
  try {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}
