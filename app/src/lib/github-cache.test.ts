import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'

import { createFileGithubCache } from './github-file-cache.ts'

describe('createFileGithubCache', () => {
  let dir: string | undefined

  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('round-trips a tree cache entry', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-cache-'))
    const cache = createFileGithubCache(dir)
    await cache.set('github:acme/handbook@:', {
      treeSha: 'tree1',
      files: { 'README.md': '# Hi\n' },
    })
    const hit = await cache.get('github:acme/handbook@:')
    assert.deepEqual(hit, {
      treeSha: 'tree1',
      files: { 'README.md': '# Hi\n' },
    })
  })

  it('returns null for a missing key', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-cache-'))
    const cache = createFileGithubCache(dir)
    assert.equal(await cache.get('missing'), null)
  })
})
