// Posix-only path helpers. The mobile target never sees Windows separators and
// cannot import `node:path`, so `src/lib/note-path.ts` is replaced by these.

export function normalizeRelative(value: string): string {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

export function joinPath(...parts: string[]): string {
  return parts
    .map((part) => normalizeRelative(part))
    .filter(Boolean)
    .join('/')
}

export function dirname(file: string): string {
  const rel = normalizeRelative(file)
  const at = rel.lastIndexOf('/')
  return at === -1 ? '' : rel.slice(0, at)
}

export function basename(file: string): string {
  const rel = normalizeRelative(file)
  const at = rel.lastIndexOf('/')
  return at === -1 ? rel : rel.slice(at + 1)
}

export function extname(file: string): string {
  const name = basename(file)
  const at = name.lastIndexOf('.')
  return at <= 0 ? '' : name.slice(at)
}

/**
 * Collapses `.` / `..` segments and refuses anything that would escape the
 * notes root. Mirrors `resolveInside` from the desktop build, but returns a
 * path relative to the root because Capacitor's Filesystem API is root-relative.
 */
export function resolveInside(root: string, relative: string): string {
  const out: string[] = []
  for (const part of normalizeRelative(relative).split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (!out.length) throw new Error('Path must stay inside the notes folder')
      out.pop()
      continue
    }
    out.push(part)
  }
  return joinPath(root, out.join('/'))
}
