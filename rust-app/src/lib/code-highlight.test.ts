import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { highlightSource } from './code-highlight.ts'

describe('highlightSource', () => {
  it('marks javascript keywords', () => {
    assert.match(highlightSource('const x = 1', 'js'), /hljs-keyword/)
  })

  it('marks css selectors', () => {
    assert.match(highlightSource('body { color: red; }', 'css'), /hljs-selector-tag/)
  })

  it('marks html tags', () => {
    assert.match(highlightSource('<div class="x"></div>', 'html'), /hljs-(?:tag|name|attr)/)
  })
})
