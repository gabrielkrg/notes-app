import path from 'node:path'

export function resolveInside(root: string, relative: string): string {
  const base = path.resolve(root)
  const abs = path.resolve(base, String(relative || ''))
  if (abs !== base && !abs.startsWith(`${base}${path.sep}`)) {
    throw new Error('Path must stay inside the notes folder')
  }
  return abs
}
