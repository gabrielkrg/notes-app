import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'

import { ASSET_MAX_BYTES, isAssetFile, readAssetAt } from './note-asset.ts'

describe('isAssetFile', () => {
  it('accepts image extensions only', () => {
    assert.equal(isAssetFile('php/logo.png'), true)
    assert.equal(isAssetFile('php/logo.JPG'), true)
    assert.equal(isAssetFile('php/logo.svg'), true)
    assert.equal(isAssetFile('php/theme.css'), false)
    assert.equal(isAssetFile('php/secret.env'), false)
  })
})

describe('readAssetAt', () => {
  let root: string | undefined

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
  })

  it('returns a data url for an image inside the notes root', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-asset-'))
    root = dir
    const file = 'php/logo.png'
    fs.mkdirSync(path.join(dir, 'php'))
    fs.writeFileSync(path.join(dir, file), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const result = readAssetAt(dir, file)
    assert.equal(result.file, file)
    assert.match(result.dataUrl, /^data:image\/png;base64,/)
  })

  it('rejects a path that escapes the notes root', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-asset-'))
    root = dir
    assert.throws(() => readAssetAt(dir, '../secret.png'), /inside/i)
  })

  it('rejects a non-image file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-asset-'))
    root = dir
    fs.writeFileSync(path.join(dir, 'notes.env'), 'SECRET=1\n')
    assert.throws(() => readAssetAt(dir, 'notes.env'), /image/i)
  })

  it('rejects a file larger than the cap', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-asset-'))
    root = dir
    const file = 'huge.png'
    fs.writeFileSync(path.join(dir, file), Buffer.alloc(ASSET_MAX_BYTES + 1))
    assert.throws(() => readAssetAt(dir, file), /too large/i)
  })
})
