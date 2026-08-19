import { labelNotesRoots, parseNotesRootEnv, resolveVirtualNote } from './notes-roots.ts'

function env(): ImportMetaEnv | Record<string, string | undefined> {
  return typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}
}

export function envValue(name: string, fallback = ''): string {
  const value = env()[name as keyof ImportMetaEnv]
  if (value == null || value === '') return fallback
  return String(value)
}

export function notesRoots(): string[] {
  return parseNotesRootEnv(envValue('VITE_NOTES_ROOT'))
}

export function notesRoot(): string {
  return notesRoots()[0] || ''
}

export function editorProtocol(): string {
  return envValue('VITE_EDITOR_PROTOCOL', 'cursor://file')
}

export function storagePrefix(): string {
  return envValue('VITE_STORAGE_PREFIX', 'notes')
}

export function storageKey(suffix: string, prefix = storagePrefix()): string {
  return `${prefix}.${suffix}`
}

export function joinNotesPath(root: string, file: string): string {
  const base = String(root || '').replace(/\\/g, '/').replace(/\/+$/, '')
  const rel = String(file || '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!base) return rel
  if (!rel) return base
  return `${base}/${rel}`
}

export type NoteEditorHrefOptions = {
  protocol?: string
  notesRoots?: string[]
  notesRoot?: string
}

export function noteEditorHref(file: string, options: NoteEditorHrefOptions = {}): string {
  const protocol = options.protocol ?? editorProtocol()
  const roots = options.notesRoots ?? (options.notesRoot != null ? [options.notesRoot] : notesRoots())
  const { root, relative } = resolveVirtualNote(file, labelNotesRoots(roots))
  return `${protocol}${joinNotesPath(root, relative)}`
}
