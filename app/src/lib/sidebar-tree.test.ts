import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  depthPad,
  dirOpenId,
  ensureOpenId,
  folderOpenChange,
  toggleOpenId,
  treeLine,
} from './sidebar-tree.ts'

function padUnits(className: string | undefined) {
  if (!className) return 2
  const match = className.match(/pl-(\d+)/)
  assert.ok(match, `expected padding class, got ${className}`)
  return Number(match[1])
}

function lineLeft(className: string) {
  const match = className.match(/before:left-(\d+)/)
  assert.ok(match, `expected tree line offset, got ${className}`)
  return Number(match[1])
}

describe('sidebar tree indent', () => {
  it('keeps each nested level at least 2rem deeper so files sit inside their folder', () => {
    assert.equal(depthPad(0), undefined)
    assert.ok(padUnits(depthPad(2)) - padUnits(depthPad(1)) >= 8)
    assert.ok(padUnits(depthPad(3)) - padUnits(depthPad(2)) >= 8)
  })

  it('moves the tree guide line with each nested folder', () => {
    assert.ok(lineLeft(treeLine(1)) - lineLeft(treeLine(0)) >= 8)
    assert.ok(lineLeft(treeLine(2)) - lineLeft(treeLine(1)) >= 8)
  })
})

const folders = [
  { type: 'dir' as const, id: 'notes', path: 'notes' },
  { type: 'dir' as const, id: 'docs', path: 'documents' },
  { type: 'page' as const, id: 'readme', path: 'readme' },
]

describe('dirOpenId', () => {
  it('finds the folder that contains the current route', () => {
    assert.equal(dirOpenId(folders, 'notes/php/arrays'), 'notes')
    assert.equal(dirOpenId(folders, 'documents'), 'docs')
  })

  it('returns null when the route is not inside a folder', () => {
    assert.equal(dirOpenId(folders, ''), null)
    assert.equal(dirOpenId(folders, 'readme'), null)
  })
})

describe('toggleOpenId', () => {
  it('can keep more than one folder open', () => {
    const next = toggleOpenId(toggleOpenId([], 'notes', true), 'docs', true)
    assert.deepEqual(next, ['notes', 'docs'])
  })

  it('closes one folder without closing the others', () => {
    assert.deepEqual(toggleOpenId(['notes', 'docs'], 'notes', false), ['docs'])
  })
})

describe('ensureOpenId', () => {
  it('opens the route folder without dropping folders already open', () => {
    assert.deepEqual(ensureOpenId(['docs'], 'notes'), ['docs', 'notes'])
    assert.deepEqual(ensureOpenId(['notes'], 'notes'), ['notes'])
    assert.deepEqual(ensureOpenId(['docs'], null), ['docs'])
  })
})

describe('folderOpenChange', () => {
  it('navigates when a closed folder is opened', () => {
    assert.deepEqual(folderOpenChange(true, 'documents', 'notes/php'), {
      open: true,
      go: 'documents',
    })
  })

  it('can close a folder without navigating away', () => {
    assert.deepEqual(folderOpenChange(false, 'documents', 'notes/php'), { open: false })
  })
})
