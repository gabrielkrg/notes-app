export const ASSET_MAX_BYTES = 5 * 1024 * 1024

const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|ico)$/i

export function isAssetFile(file: string): boolean {
  return ASSET_EXT.test(String(file))
}

export function assetMimeFor(file: string): string {
  const name = String(file).replace(/\\/g, '/')
  const at = name.lastIndexOf('.')
  const ext = at <= 0 ? '' : name.slice(at).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.ico') return 'image/x-icon'
  return 'application/octet-stream'
}
