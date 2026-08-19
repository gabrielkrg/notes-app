import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isNoteFile, noteFileFromName, slugifyName, starterMarkdown } from './note-name.ts'

describe('slugifyName', () => {
  it('turns a title into a lowercase hyphenated slug', () => {
    assert.equal(slugifyName('Time and Space'), 'time-and-space')
  })

  it('strips path separators and extra punctuation', () => {
    assert.equal(slugifyName('../Secret Note!!'), 'secret-note')
  })

  it('rejects a name that slugs to empty', () => {
    assert.throws(() => slugifyName('***'), /name/i)
  })
})

describe('noteFileFromName', () => {
  it('creates a markdown file under the parent folder', () => {
    assert.equal(noteFileFromName('Arrays', { parent: 'php', kind: 'note' }), 'php/arrays.md')
  })

  it('creates a folder index at the parent', () => {
    assert.equal(
      noteFileFromName('Interview Prep', { parent: '', kind: 'folder' }),
      'interview-prep/index.md',
    )
  })
})

describe('isNoteFile', () => {
  it('accepts markdown and text notes', () => {
    assert.equal(isNoteFile('php/arrays.md'), true)
    assert.equal(isNoteFile('php/test.txt'), true)
    assert.equal(isNoteFile('php/notes.pdf'), false)
  })
})

describe('starterMarkdown', () => {
  it('includes title frontmatter and a heading', () => {
    const raw = starterMarkdown({ title: 'Queues' })
    assert.match(raw, /^---\n/)
    assert.match(raw, /title: Queues/)
    assert.match(raw, /^# Queues$/m)
  })
})
