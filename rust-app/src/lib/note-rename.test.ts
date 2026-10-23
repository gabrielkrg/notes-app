import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'

import {
  renamedFolderPath,
  renamedNoteFile,
  renameFolderAt,
  renameNoteAt,
  retitleMarkdown,
} from './note-rename.ts'

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'notes-rename-'))
}

describe('renamedNoteFile', () => {
  it('keeps the parent folder and file type', () => {
    assert.equal(renamedNoteFile('php/untitled.md', 'Meeting notes'), 'php/meeting-notes.md')
    assert.equal(renamedNoteFile('php/widget.html', 'New Widget'), 'php/new-widget.html')
  })
})

describe('renamedFolderPath', () => {
  it('renames the last folder segment', () => {
    assert.equal(renamedFolderPath('php/interview-prep', 'Interview Prep 2026'), 'php/interview-prep-2026')
    assert.equal(renamedFolderPath('scratch', 'Inbox'), 'inbox')
  })

  it('refuses to rename the notes root', () => {
    assert.throws(() => renamedFolderPath('', 'Notes'), /notes folder/i)
  })
})

describe('retitleMarkdown', () => {
  it('updates title, nav, and the first heading', () => {
    const next = retitleMarkdown(
      '---\ntitle: Untitled\nnav: Untitled\n---\n\n# Untitled\n\nBody.\n',
      'Meeting notes',
    )
    assert.match(next, /title: Meeting notes/)
    assert.match(next, /nav: Meeting notes/)
    assert.match(next, /^# Meeting notes$/m)
    assert.match(next, /Body\./)
  })

  it('does not rewrite h2 or later headings', () => {
    const next = retitleMarkdown('# Old\n\n## Keep\n', 'New')
    assert.match(next, /^# New$/m)
    assert.match(next, /^## Keep$/m)
  })
})

describe('renameNoteAt', () => {
  let root: string | undefined

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  it('renames a markdown note and retitles it', () => {
    const dir = makeRoot()
    root = dir
    fs.mkdirSync(path.join(dir, 'php'))
    fs.writeFileSync(
      path.join(dir, 'php', 'untitled.md'),
      '---\ntitle: Untitled\nnav: Untitled\n---\n\n# Untitled\n',
    )
    const result = renameNoteAt(dir, 'php/untitled.md', 'Arrays')
    assert.equal(result.file, 'php/arrays.md')
    assert.equal(fs.existsSync(path.join(dir, 'php', 'untitled.md')), false)
    const raw = fs.readFileSync(path.join(dir, 'php', 'arrays.md'), 'utf8')
    assert.match(raw, /title: Arrays/)
    assert.match(raw, /^# Arrays$/m)
  })

  it('rejects a name that already exists', () => {
    const dir = makeRoot()
    root = dir
    fs.writeFileSync(path.join(dir, 'one.md'), '# One\n')
    fs.writeFileSync(path.join(dir, 'two.md'), '# Two\n')
    assert.throws(() => renameNoteAt(dir, 'one.md', 'Two'), /already exists/i)
  })
})

describe('renameFolderAt', () => {
  let root: string | undefined

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  it('renames a folder and retitles its markdown index', () => {
    const dir = makeRoot()
    root = dir
    fs.mkdirSync(path.join(dir, 'scratch'))
    fs.writeFileSync(
      path.join(dir, 'scratch', 'index.md'),
      '---\ntitle: Scratch\nnav: Scratch\n---\n\n# Scratch\n',
    )
    fs.writeFileSync(path.join(dir, 'scratch', 'note.md'), '# Note\n')
    const result = renameFolderAt(dir, 'scratch', 'Inbox')
    assert.equal(result.path, 'inbox')
    assert.equal(fs.existsSync(path.join(dir, 'scratch')), false)
    assert.equal(fs.existsSync(path.join(dir, 'inbox', 'note.md')), true)
    const raw = fs.readFileSync(path.join(dir, 'inbox', 'index.md'), 'utf8')
    assert.match(raw, /title: Inbox/)
    assert.match(raw, /^# Inbox$/m)
  })
})
