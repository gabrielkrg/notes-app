import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { depthPad, treeLine } from './sidebar-tree.ts'

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
