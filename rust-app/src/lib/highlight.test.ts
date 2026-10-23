import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  HIGHLIGHT_COLORS,
  applyHighlightColor,
  highlightCustomProperties,
  parseHighlightColor,
} from './highlight.ts'

describe('parseHighlightColor', () => {
  it('defaults unknown or empty values to yellow', () => {
    assert.equal(parseHighlightColor(null), 'yellow')
    assert.equal(parseHighlightColor(''), 'yellow')
    assert.equal(parseHighlightColor('neon'), 'yellow')
  })

  it('accepts each palette id', () => {
    for (const color of HIGHLIGHT_COLORS) {
      assert.equal(parseHighlightColor(color.id), color.id)
    }
  })
})

describe('highlightCustomProperties', () => {
  it('exposes a CSS highlight token for the chosen color', () => {
    const yellow = highlightCustomProperties('yellow')
    const sky = highlightCustomProperties('sky')
    assert.match(yellow['--highlight'], /^oklch\(/)
    assert.notEqual(yellow['--highlight'], sky['--highlight'])
  })
})

describe('applyHighlightColor', () => {
  it('writes the highlight token onto a style target', () => {
    const set = new Map<string, string>()
    const target = {
      style: {
        setProperty(name: string, value: string) {
          set.set(name, value)
        },
      },
      dataset: {} as Record<string, string>,
    }

    applyHighlightColor('violet', target)
    assert.equal(set.get('--highlight'), highlightCustomProperties('violet')['--highlight'])
    assert.equal(target.dataset.highlight, 'violet')
  })
})
