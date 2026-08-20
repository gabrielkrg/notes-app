export const HTML_PREVIEW_SANDBOX = 'allow-scripts'
export const HTML_PREVIEW_HEIGHT_MESSAGE = 'notes-html-preview-height'

export type PreviewAssetLoader = (file: string) => string | null

const SKIP_URL = /^(https?:|mailto:|data:|blob:|#|javascript:)/i

export function resolvePreviewPath(fromFile: string, href: string): string | null {
  const trimmed = String(href || '').trim()
  if (!trimmed || SKIP_URL.test(trimmed)) return null
  const pathPart = trimmed.split('#')[0].split('?')[0]
  if (!pathPart) return null
  const fromDir = String(fromFile || '').replace(/\\/g, '/').split('/').slice(0, -1).join('/')
  try {
    const normalized = new URL(pathPart, `https://notes.local/${fromDir}/`).pathname.replace(/^\//, '')
    if (!normalized || normalized.includes('..')) return null
    return decodeURIComponent(normalized)
  } catch {
    return null
  }
}

function lookupPage(pages: Record<string, string>, file: string): string | undefined {
  if (pages[file] != null) return pages[file]
  const lower = file.toLowerCase()
  const key = Object.keys(pages).find((item) => item.toLowerCase() === lower)
  return key ? pages[key] : undefined
}

function escapeScript(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script')
}

function attr(html: string, name: string): string | null {
  const quoted = html.match(new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))
  if (quoted) return quoted[2]
  const bare = html.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, 'i'))
  return bare ? bare[1] : null
}

function rewriteCssUrls(fromFile: string, css: string, loadAsset?: PreviewAssetLoader): string {
  return String(css).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, _quote: string, url: string) => {
    const resolved = resolvePreviewPath(fromFile, url)
    if (!resolved) return full
    const data = loadAsset?.(resolved)
    if (!data) return full
    return `url(${JSON.stringify(data)})`
  })
}

function rewriteNamedAttr(tag: string, name: string, fromFile: string, loadAsset?: PreviewAssetLoader): string {
  const value = attr(tag, name)
  if (!value || !loadAsset) return tag
  const resolved = resolvePreviewPath(fromFile, value)
  if (!resolved) return tag
  const data = loadAsset(resolved)
  if (!data) return tag
  const next = `${name}="${data.replace(/"/g, '&quot;')}"`
  if (new RegExp(`${name}\\s*=\\s*["']`, 'i').test(tag)) {
    return tag.replace(new RegExp(`${name}\\s*=\\s*(["']).*?\\1`, 'i'), next)
  }
  return tag.replace(new RegExp(`${name}\\s*=\\s*[^\\s>]+`, 'i'), next)
}

const ASSET_HREF = /\.(png|jpe?g|gif|svg|webp|ico)(?:[?#].*)?$/i

function considerAsset(fromFile: string, href: string, found: Set<string>): void {
  const resolved = resolvePreviewPath(fromFile, href)
  if (resolved && ASSET_HREF.test(resolved)) found.add(resolved)
}

export function collectPreviewAssetPaths(
  fromFile: string,
  html: string,
  pages: Record<string, string> = {},
): string[] {
  const found = new Set<string>()
  const raw = String(html)
  for (const match of raw.matchAll(/\b(?:src|poster)\s*=\s*(["'])([^"']+)\1/gi)) {
    considerAsset(fromFile, match[2], found)
  }
  for (const match of raw.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0]
    const rel = attr(tag, 'rel') || ''
    const href = attr(tag, 'href')
    if (!href || !/\bstylesheet\b/i.test(rel)) continue
    const resolved = resolvePreviewPath(fromFile, href)
    if (!resolved) continue
    const css = lookupPage(pages, resolved)
    if (css == null) continue
    for (const urlMatch of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
      considerAsset(resolved, urlMatch[2], found)
    }
  }
  return [...found]
}

export function rewriteHtmlPreview(
  fromFile: string,
  html: string,
  pages: Record<string, string> = {},
  loadAsset?: PreviewAssetLoader,
): string {
  let out = String(html)

  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = attr(tag, 'rel') || ''
    if (!/\bstylesheet\b/i.test(rel)) return tag
    const href = attr(tag, 'href')
    if (!href) return tag
    const resolved = resolvePreviewPath(fromFile, href)
    if (!resolved || !/\.css$/i.test(resolved)) return tag
    const css = lookupPage(pages, resolved)
    if (css == null) return tag
    return `<style>${rewriteCssUrls(resolved, css, loadAsset)}</style>`
  })

  out = out.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs: string) => {
    const src = attr(attrs, 'src')
    if (!src) return full
    const resolved = resolvePreviewPath(fromFile, src)
    if (!resolved || !/\.js$/i.test(resolved)) return full
    const js = lookupPage(pages, resolved)
    if (js == null) return full
    const cleaned = String(attrs)
      .replace(/\ssrc\s*=\s*(["']).*?\1/i, '')
      .replace(/\ssrc\s*=\s*[^\s>]+/i, '')
    return `<script${cleaned}>${escapeScript(js)}</script>`
  })

  out = out.replace(/<(img|source)\b[^>]*>/gi, (tag) => rewriteNamedAttr(tag, 'src', fromFile, loadAsset))
  out = out.replace(/<(video|audio)\b[^>]*>/gi, (tag) => rewriteNamedAttr(tag, 'poster', fromFile, loadAsset))

  return out
}

export function isHtmlPreviewHeightMessage(
  data: unknown,
): data is { type: typeof HTML_PREVIEW_HEIGHT_MESSAGE; height: number } {
  if (!data || typeof data !== 'object') return false
  const payload = data as { type?: unknown; height?: unknown }
  return (
    payload.type === HTML_PREVIEW_HEIGHT_MESSAGE &&
    typeof payload.height === 'number' &&
    Number.isFinite(payload.height) &&
    payload.height >= 0
  )
}

export function withPreviewHeightReporter(html: string): string {
  const script = `<script data-notes-preview-height>
(function () {
  function height() {
    var root = document.documentElement;
    var body = document.body;
    return Math.max(
      root ? root.scrollHeight : 0,
      root ? root.offsetHeight : 0,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0
    );
  }
  function report() {
    parent.postMessage({ type: ${JSON.stringify(HTML_PREVIEW_HEIGHT_MESSAGE)}, height: height() }, '*');
  }
  if (typeof ResizeObserver !== 'undefined') {
    var observer = new ResizeObserver(report);
    observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);
  }
  addEventListener('load', report);
  if (document.readyState === 'complete') report();
  else addEventListener('DOMContentLoaded', report);
})();
</script>`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}</body>`)
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${script}</html>`)
  return `${html}${script}`
}

