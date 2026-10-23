import { storageKey } from './config.ts'

export type NoteEditorTab = 'editor' | 'text'

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function tabKey() {
  return storageKey('note-editor-tab')
}

export function parseNoteEditorTab(value: unknown): NoteEditorTab {
  return value === 'text' ? 'text' : 'editor'
}

export function loadNoteEditorTab(storage: StorageLike): NoteEditorTab {
  try {
    return parseNoteEditorTab(storage.getItem(tabKey()))
  } catch {
    return 'editor'
  }
}

export function saveNoteEditorTab(storage: StorageLike, tab: NoteEditorTab): void {
  storage.setItem(tabKey(), parseNoteEditorTab(tab))
}
