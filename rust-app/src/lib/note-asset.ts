import fs from 'node:fs'

import { assetMimeFor, ASSET_MAX_BYTES, isAssetFile } from './note-asset-core.ts'
import { resolveInside } from './note-path.ts'

export { ASSET_MAX_BYTES, isAssetFile }

export function readAssetAt(root: string, file: string): { file: string; dataUrl: string } {
  const rel = String(file || '').replace(/\\/g, '/')
  if (!isAssetFile(rel)) {
    throw new Error('Only image files can be loaded as assets')
  }
  const abs = resolveInside(root, rel)
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new Error('Asset not found')
  }
  const size = fs.statSync(abs).size
  if (size > ASSET_MAX_BYTES) {
    throw new Error('Asset is too large')
  }
  const dataUrl = `data:${assetMimeFor(rel)};base64,${fs.readFileSync(abs).toString('base64')}`
  return { file: rel, dataUrl }
}
