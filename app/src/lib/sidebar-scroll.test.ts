import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { centerScrollTop } from './sidebar-scroll.ts'

const base = { itemHeight: 32, viewHeight: 400, scrollHeight: 2000, scrollTop: 0 }

describe('centerScrollTop', () => {
  it('centers an item below the fold', () => {
    assert.equal(centerScrollTop({ ...base, itemTop: 1000 }), 816)
  })

  it('centers an item scrolled off the top', () => {
    assert.equal(centerScrollTop({ ...base, itemTop: 100, scrollTop: 900 }), 0)
  })

  it('leaves a comfortably visible item alone', () => {
    assert.equal(centerScrollTop({ ...base, itemTop: 200 }), null)
  })

  it('centers an item hugging a viewport edge', () => {
    assert.equal(centerScrollTop({ ...base, itemTop: 380 }), 196)
  })

  it('clamps to the end of the content', () => {
    assert.equal(centerScrollTop({ ...base, itemTop: 1980, scrollTop: 0 }), 1600)
  })

  it('does nothing when the list fits', () => {
    assert.equal(centerScrollTop({ ...base, itemTop: 300, scrollHeight: 400 }), null)
  })
})
