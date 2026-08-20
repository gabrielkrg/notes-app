import fs from 'node:fs'
import path from 'node:path'

import { resolveInside } from './note-path.ts'

export const ASSET_MAX_BYTES = 5 * 1024 * 1024

const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|ico)$/i

export function isAssetFile(file: string): boolean {
  return ASSET_EXT.test(String(file))
}

function mimeFor(file: string): string {
  const ext = path.extname(String(file)).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.ico') return 'image/x-icon'
  return 'application/octet-stream'
}

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
  const dataUrl = `data:${mimeFor(rel)};base64,${fs.readFileSync(abs).toString('base64')}`
  return { file: rel, dataUrl }
}
