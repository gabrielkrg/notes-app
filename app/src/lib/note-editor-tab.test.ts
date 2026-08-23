import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  loadNoteEditorTab,
  parseNoteEditorTab,
  saveNoteEditorTab,
} from './note-editor-tab.ts'

describe('parseNoteEditorTab', () => {
  it('defaults unknown or empty values to editor', () => {
    assert.equal(parseNoteEditorTab(null), 'editor')
    assert.equal(parseNoteEditorTab(''), 'editor')
    assert.equal(parseNoteEditorTab('preview'), 'editor')
  })

  it('accepts editor and text', () => {
    assert.equal(parseNoteEditorTab('editor'), 'editor')
    assert.equal(parseNoteEditorTab('text'), 'text')
  })
})

describe('note editor tab storage', () => {
  it('round-trips the last selected tab', () => {
    const storage = memoryStorage()
    saveNoteEditorTab(storage, 'text')
    assert.equal(loadNoteEditorTab(storage), 'text')
  })

  it('falls back to editor when storage is empty or invalid', () => {
    const storage = memoryStorage()
    assert.equal(loadNoteEditorTab(storage), 'editor')
    storage.setItem('notes.note-editor-tab', 'preview')
    assert.equal(loadNoteEditorTab(storage), 'editor')
  })
})

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
  }
}
