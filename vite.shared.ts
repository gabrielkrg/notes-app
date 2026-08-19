import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

import { parseNotesRootEnv } from './browser/src/lib/notes-roots.ts'

export const rootDir = path.dirname(fileURLToPath(import.meta.url))
export const browserDir = path.join(rootDir, 'browser')
export const desktopDir = path.join(rootDir, 'desktop')

export function loadAppEnv(mode: string) {
  const env = loadEnv(mode, rootDir, '')
  const configured = parseNotesRootEnv(env.VITE_NOTES_ROOT || '')
  const notesRoots = (configured.length ? configured : [path.join(rootDir, 'notes')]).map((dir) =>
    path.resolve(dir),
  )
  const notesRoot = notesRoots[0]
  const port = Number(env.VITE_DEV_PORT || 5173)

  process.env.VITE_NOTES_ROOT = notesRoots.join(',')
  process.env.VITE_EDITOR_PROTOCOL ||= env.VITE_EDITOR_PROTOCOL || 'cursor://file'
  process.env.VITE_STORAGE_PREFIX ||= env.VITE_STORAGE_PREFIX || 'notes'
  process.env.LAUNCH_EDITOR ??= env.LAUNCH_EDITOR || 'cursor'

  return { env, notesRoot, notesRoots, port }
}
