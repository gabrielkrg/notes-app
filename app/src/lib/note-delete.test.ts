import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'

import {
  confirmFolderName,
  deleteFolderAt,
  deleteNoteAt,
} from './note-delete.ts'

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'notes-delete-'))
}

describe('confirmFolderName', () => {
  it('requires an exact trimmed match of an allowed name', () => {
    assert.equal(confirmFolderName('PHP', ['PHP', 'php']), true)
    assert.equal(confirmFolderName('  PHP  ', ['PHP']), true)
    assert.equal(confirmFolderName('php', ['PHP']), false)
    assert.equal(confirmFolderName('', ['PHP']), false)
  })
})

describe('deleteNoteAt', () => {
  let root: string | undefined

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  it('removes a note file inside the root', () => {
    const dir = makeRoot()
    root = dir
    const file = 'php/arrays.md'
    fs.mkdirSync(path.join(dir, 'php'))
    fs.writeFileSync(path.join(dir, file), '# Arrays\n')
    const result = deleteNoteAt(dir, file)
    assert.equal(result.file, file)
    assert.equal(fs.existsSync(path.join(dir, file)), false)
  })

  it('removes an html note', () => {
    const dir = makeRoot()
    root = dir
    const file = 'php/widget.html'
    fs.mkdirSync(path.join(dir, 'php'))
    fs.writeFileSync(path.join(dir, file), '<h1>Widget</h1>\n')
    deleteNoteAt(dir, file)
    assert.equal(fs.existsSync(path.join(dir, file)), false)
  })

  it('rejects paths that escape the notes root', () => {
    const dir = makeRoot()
    root = dir
    assert.throws(() => deleteNoteAt(dir, '../secret.md'), /inside/i)
  })
})

describe('deleteFolderAt', () => {
  let root: string | undefined

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  it('removes a folder when the typed name matches', () => {
    const dir = makeRoot()
    root = dir
    fs.mkdirSync(path.join(dir, 'php'))
    fs.writeFileSync(path.join(dir, 'php', 'index.md'), '# PHP\n')
    deleteFolderAt(dir, 'php', { confirmName: 'PHP', expectedNames: ['PHP'] })
    assert.equal(fs.existsSync(path.join(dir, 'php')), false)
  })

  it('does not delete when the typed name does not match', () => {
    const dir = makeRoot()
    root = dir
    fs.mkdirSync(path.join(dir, 'php'))
    assert.throws(
      () => deleteFolderAt(dir, 'php', { confirmName: 'nope', expectedNames: ['PHP'] }),
      /folder name/i,
    )
    assert.equal(fs.existsSync(path.join(dir, 'php')), true)
  })

  it('refuses to delete the notes root', () => {
    const dir = makeRoot()
    root = dir
    assert.throws(
      () => deleteFolderAt(dir, '', { confirmName: 'notes', expectedNames: ['notes'] }),
      /notes folder/i,
    )
  })
})
