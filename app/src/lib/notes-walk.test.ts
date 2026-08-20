import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'

import {
  acceptedNotesRoots,
  assertNotesRootLoadable,
  isTooBroadNotesRoot,
  loadNotesRoots,
  NotesFolderTooLargeError,
  walkNotes,
} from './notes-walk.ts'

describe('walkNotes', () => {
  let root: string | undefined

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  it('reads markdown files relative to an absolute notes folder', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-walk-'))
    fs.mkdirSync(path.join(root, 'php'))
    fs.writeFileSync(path.join(root, 'php', 'arrays.md'), '# Arrays\n')
    fs.writeFileSync(path.join(root, 'php', 'notes.md'), '# Nested name\n')

    const files = walkNotes(root)
    assert.equal(files['php/arrays.md'], '# Arrays\n')
    assert.equal(files['php/notes.md'], '# Nested name\n')
  })

  it('skips markdown files inside node_modules', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-walk-'))
    fs.writeFileSync(path.join(root, 'keep.md'), '# Keep\n')
    fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true })
    fs.writeFileSync(path.join(root, 'node_modules', 'pkg', 'README.md'), '# Vendor\n')

    const files = walkNotes(root)
    assert.equal(files['keep.md'], '# Keep\n')
    assert.equal(files['node_modules/pkg/README.md'], undefined)
  })

  it('throws when a folder has more note files than the limit', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-walk-'))
    root = dir
    fs.writeFileSync(path.join(dir, 'one.md'), '# One\n')
    fs.writeFileSync(path.join(dir, 'two.md'), '# Two\n')
    fs.writeFileSync(path.join(dir, 'three.md'), '# Three\n')

    assert.throws(() => walkNotes(dir, { maxFiles: 2 }), NotesFolderTooLargeError)
  })
})

describe('isTooBroadNotesRoot', () => {
  it('rejects the home directory and filesystem root', () => {
    assert.equal(isTooBroadNotesRoot('/home/gabriel', '/home/gabriel'), true)
    assert.equal(isTooBroadNotesRoot('/', '/home/gabriel'), true)
    assert.equal(isTooBroadNotesRoot('/home', '/home/gabriel'), true)
    assert.equal(isTooBroadNotesRoot('/home/gabriel/t/notes', '/home/gabriel'), false)
  })
})

describe('loadNotesRoots', () => {
  let vault: string | undefined
  let home: string | undefined

  afterEach(() => {
    if (vault) fs.rmSync(vault, { recursive: true, force: true })
    if (home) fs.rmSync(home, { recursive: true, force: true })
  })

  it('still loads a notes vault when a home-sized root is also attached', () => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-vault-'))
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-home-'))
    fs.writeFileSync(path.join(vault, 'desk.md'), '# Desk\n')
    fs.writeFileSync(path.join(home, 'noise.md'), '# Noise\n')

    const loaded = loadNotesRoots([vault, home], home)
    assert.deepEqual(loaded, [{ root: vault, files: { 'desk.md': '# Desk\n' } }])
  })
})

describe('assertNotesRootLoadable', () => {
  let root: string | undefined

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  it('rejects the home directory before any walk', () => {
    assert.throws(
      () => assertNotesRootLoadable('/home/gabriel', '/home/gabriel'),
      /home directory or an entire drive/,
    )
  })

  it('accepts a small notes folder', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-ok-'))
    fs.writeFileSync(path.join(root, 'desk.md'), '# Desk\n')
    assertNotesRootLoadable(root)
  })

  it('rejects a folder with more note files than the limit', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-big-'))
    root = dir
    fs.writeFileSync(path.join(dir, 'one.md'), '# One\n')
    fs.writeFileSync(path.join(dir, 'two.md'), '# Two\n')
    fs.writeFileSync(path.join(dir, 'three.md'), '# Three\n')

    assert.throws(() => assertNotesRootLoadable(dir, os.homedir(), { maxFiles: 2 }), NotesFolderTooLargeError)
  })
})

describe('acceptedNotesRoots', () => {
  let vault: string | undefined
  let extra: string | undefined

  afterEach(() => {
    if (vault) fs.rmSync(vault, { recursive: true, force: true })
    if (extra) fs.rmSync(extra, { recursive: true, force: true })
  })

  it('returns unique existing folders that pass the loadable check', () => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-vault-'))
    fs.writeFileSync(path.join(vault, 'desk.md'), '# Desk\n')

    assert.deepEqual(acceptedNotesRoots([vault, vault]), [path.resolve(vault)])
  })

  it('does not return a too-large folder that was requested', () => {
    const ok = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-vault-'))
    const huge = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-huge-'))
    vault = ok
    extra = huge
    fs.writeFileSync(path.join(ok, 'desk.md'), '# Desk\n')
    fs.writeFileSync(path.join(huge, 'one.md'), '# One\n')
    fs.writeFileSync(path.join(huge, 'two.md'), '# Two\n')
    fs.writeFileSync(path.join(huge, 'three.md'), '# Three\n')

    assert.throws(
      () => acceptedNotesRoots([ok, huge], os.homedir(), { maxFiles: 2 }),
      NotesFolderTooLargeError,
    )
  })
})
