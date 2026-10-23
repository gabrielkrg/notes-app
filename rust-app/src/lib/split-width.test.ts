import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  SPLIT_WIDTH_DEFAULT,
  SPLIT_WIDTH_MAX,
  SPLIT_WIDTH_MIN,
  clampSplitWidth,
  formatSplitWidth,
  loadSplitWidth,
  parseSplitWidth,
  saveSplitWidth,
  splitWidthFromPointer,
} from './split-width.ts'

function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

describe('clampSplitWidth', () => {
  it('keeps a width inside the allowed range', () => {
    assert.equal(clampSplitWidth(50), 50)
    assert.equal(clampSplitWidth(SPLIT_WIDTH_MIN - 10), SPLIT_WIDTH_MIN)
    assert.equal(clampSplitWidth(SPLIT_WIDTH_MAX + 10), SPLIT_WIDTH_MAX)
  })

  it('falls back to the default for junk', () => {
    assert.equal(clampSplitWidth(Number.NaN), SPLIT_WIDTH_DEFAULT)
  })
})

describe('formatSplitWidth', () => {
  it('renders a clamped percentage', () => {
    assert.equal(formatSplitWidth(40), '40%')
    assert.equal(formatSplitWidth(1000), `${SPLIT_WIDTH_MAX}%`)
  })
})

describe('parseSplitWidth', () => {
  it('defaults when the stored value is missing or unusable', () => {
    assert.equal(parseSplitWidth(null), SPLIT_WIDTH_DEFAULT)
    assert.equal(parseSplitWidth(''), SPLIT_WIDTH_DEFAULT)
    assert.equal(parseSplitWidth('wide'), SPLIT_WIDTH_DEFAULT)
  })

  it('reads and clamps a stored value', () => {
    assert.equal(parseSplitWidth('35'), 35)
    assert.equal(parseSplitWidth('99'), SPLIT_WIDTH_MAX)
  })
})

describe('loadSplitWidth / saveSplitWidth', () => {
  it('round-trips through storage', () => {
    const store = storage()
    saveSplitWidth(store, 38)
    assert.equal(loadSplitWidth(store), 38)
  })

  it('defaults when storage throws', () => {
    const store = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {},
    }
    assert.equal(loadSplitWidth(store), SPLIT_WIDTH_DEFAULT)
  })
})

describe('splitWidthFromPointer', () => {
  it('converts a pixel delta into a percentage of the container', () => {
    assert.equal(splitWidthFromPointer(50, 100, 1000), 60)
    assert.equal(splitWidthFromPointer(50, -100, 1000), 40)
  })

  it('clamps the result and survives a zero-width container', () => {
    assert.equal(splitWidthFromPointer(50, 10000, 1000), SPLIT_WIDTH_MAX)
    assert.equal(splitWidthFromPointer(50, 100, 0), 50)
  })
})
