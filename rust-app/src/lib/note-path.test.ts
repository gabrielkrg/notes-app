import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'

import { resolveInside } from './note-path.ts'

describe('resolveInside', () => {
  const root = path.resolve('/tmp/notes-root')

  it('joins a relative note path inside the root', () => {
    assert.equal(
      resolveInside(root, 'php/arrays.md'),
      path.join(root, 'php', 'arrays.md'),
    )
  })

  it('rejects paths that escape the notes root', () => {
    assert.throws(() => resolveInside(root, '../secret.md'), /inside/i)
    assert.throws(() => resolveInside(root, 'php/../../secret.md'), /inside/i)
  })
})
