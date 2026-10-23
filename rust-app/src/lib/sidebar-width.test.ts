import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  clampSidebarWidth,
  formatSidebarWidth,
  loadSidebarWidth,
  saveSidebarWidth,
  widthFromPointer,
} from './sidebar-width.ts'

describe('clampSidebarWidth', () => {
  it('keeps widths inside 14rem and 32rem', () => {
    assert.equal(clampSidebarWidth(10), SIDEBAR_WIDTH_MIN)
    assert.equal(clampSidebarWidth(40), SIDEBAR_WIDTH_MAX)
    assert.equal(clampSidebarWidth(20), 20)
  })
})

describe('sidebar width storage', () => {
  it('round-trips a width in storage', () => {
    const storage = memoryStorage()
    saveSidebarWidth(storage, 22)
    assert.equal(loadSidebarWidth(storage), 22)
  })

  it('falls back to the default width when storage is empty or invalid', () => {
    const storage = memoryStorage()
    assert.equal(loadSidebarWidth(storage), SIDEBAR_WIDTH_DEFAULT)
    storage.setItem('notes.sidebar-width', 'nope')
    assert.equal(loadSidebarWidth(storage), SIDEBAR_WIDTH_DEFAULT)
  })

  it('clamps values before saving', () => {
    const storage = memoryStorage()
    saveSidebarWidth(storage, 99)
    assert.equal(loadSidebarWidth(storage), SIDEBAR_WIDTH_MAX)
  })
})

describe('widthFromPointer', () => {
  it('converts a horizontal drag into a clamped rem width', () => {
    assert.equal(widthFromPointer(16, 32, 16), 18)
    assert.equal(widthFromPointer(16, -1000, 16), SIDEBAR_WIDTH_MIN)
  })
})

describe('formatSidebarWidth', () => {
  it('emits a CSS rem value', () => {
    assert.equal(formatSidebarWidth(18), '18rem')
  })
})

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
    removeItem(key: string) {
      map.delete(key)
    },
  }
}
