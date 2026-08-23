import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { bookmarkEntries, parseBookmarks, toggleBookmark } from './bookmarks.ts'

describe('parseBookmarks', () => {
  it('defaults unknown values to an empty list', () => {
    assert.deepEqual(parseBookmarks(null), [])
    assert.deepEqual(parseBookmarks(''), [])
    assert.deepEqual(parseBookmarks({}), [])
  })

  it('keeps unique trimmed file paths in order', () => {
    assert.deepEqual(parseBookmarks([' php/arrays.md ', 'php/arrays.md', 'sql/joins.md', '']), [
      'php/arrays.md',
      'sql/joins.md',
    ])
  })
})

describe('toggleBookmark', () => {
  it('adds a missing file and removes one that is already bookmarked', () => {
    assert.deepEqual(toggleBookmark([], 'php/arrays.md'), ['php/arrays.md'])
    assert.deepEqual(toggleBookmark(['php/arrays.md', 'sql/joins.md'], 'php/arrays.md'), ['sql/joins.md'])
  })

  it('ignores a blank file path', () => {
    assert.deepEqual(toggleBookmark(['php/arrays.md'], '  '), ['php/arrays.md'])
  })
})

describe('bookmarkEntries', () => {
  it('resolves titles and routes from known pages', () => {
    const entries = bookmarkEntries(['php/arrays.md', 'missing.md'], {
      'php/arrays.md': { file: 'php/arrays.md', title: 'Arrays', route: 'php/arrays' },
    })
    assert.deepEqual(entries, [
      { file: 'php/arrays.md', title: 'Arrays', route: 'php/arrays' },
      { file: 'missing.md', title: 'missing.md', route: null },
    ])
  })
})
