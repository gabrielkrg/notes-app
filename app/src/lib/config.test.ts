import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { joinNotesPath, noteEditorHref, storageKey } from './config.ts'

describe('joinNotesPath', () => {
  it('joins a notes root and relative file', () => {
    assert.equal(
      joinNotesPath('/home/me/notes', 'php/arrays.md'),
      '/home/me/notes/php/arrays.md',
    )
  })

  it('normalizes slashes', () => {
    assert.equal(
      joinNotesPath('/home/me/notes/', '/php/arrays.md'),
      '/home/me/notes/php/arrays.md',
    )
  })
})

describe('noteEditorHref', () => {
  it('builds an editor URL from env-style options', () => {
    assert.equal(
      noteEditorHref('php/arrays.md', {
        notesRoot: '/home/me/notes',
        protocol: 'cursor://file',
      }),
      'cursor://file/home/me/notes/php/arrays.md',
    )
  })

  it('resolves a namespaced file against the matching root', () => {
    assert.equal(
      noteEditorHref('work/sql/indexing.md', {
        notesRoots: ['/home/me/notes', '/home/me/work'],
        protocol: 'cursor://file',
      }),
      'cursor://file/home/me/work/sql/indexing.md',
    )
  })
})

describe('storageKey', () => {
  it('prefixes localStorage keys', () => {
    assert.equal(storageKey('theme', 'notes'), 'notes.theme')
  })
})
