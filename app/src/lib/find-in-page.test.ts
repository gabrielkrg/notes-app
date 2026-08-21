import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  findMatches,
  isFindNextShortcut,
  isFindPrevShortcut,
  isFindShortcut,
  stepFindIndex,
  wrapIndex,
} from './find-in-page.ts'

function keyEvent({
  key,
  ctrlKey = false,
  metaKey = false,
  shiftKey = false,
}: {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}) {
  return { key, ctrlKey, metaKey, shiftKey }
}

describe('findMatches', () => {
  it('finds a sentence case-insensitively', () => {
    const text = 'Hello there.\nHELLO there again.'
    assert.deepEqual(findMatches(text, 'hello there'), [
      { start: 0, end: 11 },
      { start: 13, end: 24 },
    ])
  })

  it('returns nothing for an empty query', () => {
    assert.deepEqual(findMatches('Hello', '  '), [])
  })

  it('finds overlapping matches from each next character', () => {
    assert.deepEqual(findMatches('aaaa', 'aa'), [
      { start: 0, end: 2 },
      { start: 1, end: 3 },
      { start: 2, end: 4 },
    ])
  })
})

describe('wrapIndex', () => {
  it('wraps forward and backward', () => {
    assert.equal(wrapIndex(0, 3), 0)
    assert.equal(wrapIndex(3, 3), 0)
    assert.equal(wrapIndex(-1, 3), 2)
  })

  it('returns -1 when there are no matches', () => {
    assert.equal(wrapIndex(0, 0), -1)
  })
})

describe('stepFindIndex', () => {
  it('stays on the current match until one has been revealed', () => {
    assert.equal(stepFindIndex(0, 1, false), 0)
    assert.equal(stepFindIndex(0, -1, false), 0)
  })

  it('steps after a match is already in view', () => {
    assert.equal(stepFindIndex(0, 1, true), 1)
    assert.equal(stepFindIndex(2, -1, true), 1)
  })
})

describe('find shortcuts', () => {
  it('matches Ctrl+F and Cmd+F', () => {
    assert.equal(isFindShortcut(keyEvent({ key: 'f', ctrlKey: true })), true)
    assert.equal(isFindShortcut(keyEvent({ key: 'F', metaKey: true })), true)
    assert.equal(isFindShortcut(keyEvent({ key: 'f', ctrlKey: true, shiftKey: true })), false)
    assert.equal(isFindShortcut(keyEvent({ key: 'k', ctrlKey: true })), false)
  })

  it('matches F3 and Shift+F3', () => {
    assert.equal(isFindNextShortcut(keyEvent({ key: 'F3' })), true)
    assert.equal(isFindPrevShortcut(keyEvent({ key: 'F3', shiftKey: true })), true)
    assert.equal(isFindNextShortcut(keyEvent({ key: 'F3', shiftKey: true })), false)
  })
})
