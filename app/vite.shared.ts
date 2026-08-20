import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

import { parseNotesRootEnv } from './src/lib/notes-roots.ts'

export const appDir = path.dirname(fileURLToPath(import.meta.url))
export const repoDir = path.join(appDir, '..')
export const desktopDir = path.join(appDir, 'desktop')

export function loadAppEnv(mode: string) {
  const env = loadEnv(mode, appDir, '')
  const configured = parseNotesRootEnv(env.VITE_NOTES_ROOT || '')
  const notesRoots = (configured.length ? configured : [path.join(repoDir, 'notes')]).map((dir) =>
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
