import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  fileKind,
  isNoteFile,
  nextUntitledName,
  noteFileFromName,
  parseNoteFileType,
  slugifyName,
  starterForType,
  starterHtml,
  starterMarkdown,
} from './note-name.ts'

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

describe('nextUntitledName', () => {
  it('starts at Untitled when the parent is empty', () => {
    assert.equal(nextUntitledName(() => false), 'Untitled')
  })

  it('skips Untitled files that already exist in the parent folder', () => {
    const taken = new Set(['php/untitled.md', 'php/untitled-2.md'])
    assert.equal(nextUntitledName((file) => taken.has(file), { parent: 'php' }), 'Untitled 3')
  })

  it('ignores other types and other folders', () => {
    const taken = new Set(['php/untitled.html', 'docs/untitled.md'])
    assert.equal(nextUntitledName((file) => taken.has(file), { parent: 'php' }), 'Untitled')
  })
})

describe('noteFileFromName', () => {
  it('creates a markdown file under the parent folder', () => {
    assert.equal(noteFileFromName('Arrays', { parent: 'php', kind: 'note' }), 'php/arrays.md')
  })

  it('creates html, css, js, and text files from the note type', () => {
    assert.equal(noteFileFromName('Widget', { parent: 'php', type: 'html' }), 'php/widget.html')
    assert.equal(noteFileFromName('Theme', { type: 'css' }), 'theme.css')
    assert.equal(noteFileFromName('Main', { type: 'js' }), 'main.js')
    assert.equal(noteFileFromName('Scratch', { parent: 'php', type: 'text' }), 'php/scratch.txt')
  })

  it('still creates a markdown index when the kind is folder', () => {
    assert.equal(
      noteFileFromName('Interview Prep', { parent: '', kind: 'folder', type: 'html' }),
      'interview-prep/index.md',
    )
  })
})

describe('isNoteFile', () => {
  it('accepts markdown, text, html, css, and js notes', () => {
    assert.equal(isNoteFile('php/arrays.md'), true)
    assert.equal(isNoteFile('php/test.txt'), true)
    assert.equal(isNoteFile('php/widget.html'), true)
    assert.equal(isNoteFile('php/theme.css'), true)
    assert.equal(isNoteFile('php/main.js'), true)
    assert.equal(isNoteFile('php/notes.pdf'), false)
    assert.equal(isNoteFile('php/app.ts'), false)
  })
})

describe('fileKind', () => {
  it('maps extensions to a view kind', () => {
    assert.equal(fileKind('php/arrays.md'), 'markdown')
    assert.equal(fileKind('php/test.txt'), 'text')
    assert.equal(fileKind('php/widget.html'), 'html')
    assert.equal(fileKind('php/theme.css'), 'css')
    assert.equal(fileKind('php/main.js'), 'js')
  })
})

describe('parseNoteFileType', () => {
  it('defaults omitted values to markdown', () => {
    assert.equal(parseNoteFileType(undefined), 'markdown')
    assert.equal(parseNoteFileType(''), 'markdown')
  })

  it('accepts text along with the other note types', () => {
    assert.equal(parseNoteFileType('text'), 'text')
  })

  it('rejects an unknown type', () => {
    assert.throws(() => parseNoteFileType('ts'), /unknown note type/i)
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

describe('starters', () => {
  it('builds a minimal html page from the title', () => {
    const raw = starterHtml({ title: 'Widget' })
    assert.match(raw, /<title>Widget<\/title>/)
    assert.match(raw, /<h1>Widget<\/h1>/)
  })

  it('picks a starter from the note type', () => {
    assert.match(starterForType('css', 'Theme'), /\/\* Theme \*\//)
    assert.match(starterForType('js', 'Main'), /\/\/ Main/)
    assert.match(starterForType('markdown', 'Queues'), /^---\n/)
    assert.equal(starterForType('text', 'Queues'), 'Queues\n\n')
  })
})
