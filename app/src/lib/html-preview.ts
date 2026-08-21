export const HTML_PREVIEW_SANDBOX = 'allow-scripts'
export const HTML_PREVIEW_HEIGHT_MESSAGE = 'notes-html-preview-height'
export const HTML_PREVIEW_STORAGE_MESSAGE = 'notes-html-preview-storage'
export const HTML_PREVIEW_SCROLL_MESSAGE = 'notes-html-preview-scroll'
export const HTML_PREVIEW_FIND_MESSAGE = 'notes-html-preview-find'
export const HTML_PREVIEW_FIND_RESULT_MESSAGE = 'notes-html-preview-find-result'

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export function previewStorageKey(file: string): string {
  return `notes-html-preview:${file}`
}

function stringMap(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') return null
    out[key] = item
  }
  return out
}

export function readPreviewStorage(file: string, storage?: StorageLike): Record<string, string> {
  try {
    const bag = storage ?? globalThis.localStorage
    const parsed = JSON.parse(bag.getItem(previewStorageKey(file)) || 'null') as unknown
    return stringMap(parsed) || {}
  } catch {
    return {}
  }
}

export function writePreviewStorage(
  file: string,
  data: Record<string, string>,
  storage?: StorageLike,
): void {
  const bag = storage ?? globalThis.localStorage
  bag.setItem(previewStorageKey(file), JSON.stringify(data))
}

export function isHtmlPreviewStorageMessage(
  data: unknown,
): data is { type: typeof HTML_PREVIEW_STORAGE_MESSAGE; data: Record<string, string> } {
  if (!data || typeof data !== 'object') return false
  const payload = data as { type?: unknown; data?: unknown }
  const map = stringMap(payload.data)
  return payload.type === HTML_PREVIEW_STORAGE_MESSAGE && map != null
}

export function isHtmlPreviewScrollMessage(
  data: unknown,
): data is { type: typeof HTML_PREVIEW_SCROLL_MESSAGE; y: number } {
  if (!data || typeof data !== 'object') return false
  const payload = data as { type?: unknown; y?: unknown }
  return (
    payload.type === HTML_PREVIEW_SCROLL_MESSAGE &&
    typeof payload.y === 'number' &&
    Number.isFinite(payload.y)
  )
}

export function isHtmlPreviewFindMessage(
  data: unknown,
): data is { type: typeof HTML_PREVIEW_FIND_MESSAGE; query: string; index: number; reveal?: boolean; focus?: boolean } {
  if (!data || typeof data !== 'object') return false
  const payload = data as { type?: unknown; query?: unknown; index?: unknown; reveal?: unknown; focus?: unknown }
  return (
    payload.type === HTML_PREVIEW_FIND_MESSAGE &&
    typeof payload.query === 'string' &&
    typeof payload.index === 'number' &&
    Number.isFinite(payload.index) &&
    (payload.reveal === undefined || typeof payload.reveal === 'boolean') &&
    (payload.focus === undefined || typeof payload.focus === 'boolean')
  )
}

export function isHtmlPreviewFindResultMessage(
  data: unknown,
): data is { type: typeof HTML_PREVIEW_FIND_RESULT_MESSAGE; count: number; index: number; y: number } {
  if (!data || typeof data !== 'object') return false
  const payload = data as { type?: unknown; count?: unknown; index?: unknown; y?: unknown }
  return (
    payload.type === HTML_PREVIEW_FIND_RESULT_MESSAGE &&
    typeof payload.count === 'number' &&
    Number.isFinite(payload.count) &&
    payload.count >= 0 &&
    typeof payload.index === 'number' &&
    Number.isFinite(payload.index) &&
    typeof payload.y === 'number' &&
    Number.isFinite(payload.y)
  )
}

export function scrollOffsetForPreview(
  iframeTop: number,
  scrollerTop: number,
  scrollerScrollTop: number,
  targetY: number,
): number {
  return scrollerScrollTop + (iframeTop - scrollerTop) + targetY
}

function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function previewBootstrapSource(): string {
  return `function notesPreviewBootstrap(initial) {
  var data = {};
  if (initial && typeof initial === 'object') {
    for (var key in initial) {
      if (Object.prototype.hasOwnProperty.call(initial, key) && typeof initial[key] === 'string') {
        data[key] = initial[key];
      }
    }
  }
  function copyOf(map) {
    var out = {};
    for (var key in map) {
      if (Object.prototype.hasOwnProperty.call(map, key)) out[key] = map[key];
    }
    return out;
  }
  function memoryStorage(map, persist) {
    var storage = {
      getItem: function (key) {
        key = String(key);
        return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
      },
      setItem: function (key, value) {
        map[String(key)] = String(value);
        if (persist) notify();
      },
      removeItem: function (key) {
        delete map[String(key)];
        if (persist) notify();
      },
      clear: function () {
        for (var key in map) {
          if (Object.prototype.hasOwnProperty.call(map, key)) delete map[key];
        }
        if (persist) notify();
      },
      key: function (index) {
        var keys = Object.keys(map);
        return index >= 0 && index < keys.length ? keys[index] : null;
      }
    };
    Object.defineProperty(storage, 'length', {
      get: function () { return Object.keys(map).length; }
    });
    return storage;
  }
  function notify() {
    try {
      parent.postMessage({ type: ${JSON.stringify(HTML_PREVIEW_STORAGE_MESSAGE)}, data: copyOf(data) }, '*');
    } catch (err) {}
  }
  function define(name, storage) {
    try {
      Object.defineProperty(window, name, { configurable: true, enumerable: true, value: storage });
    } catch (err) {}
  }
  define('localStorage', memoryStorage(data, true));
  define('sessionStorage', memoryStorage({}, false));
  document.addEventListener('click', function (event) {
    var node = event.target;
    while (node && node.nodeType !== 1) node = node.parentNode;
    while (node && String(node.tagName).toUpperCase() !== 'A') node = node.parentNode;
    if (!node || !node.getAttribute) return;
    var href = String(node.getAttribute('href') || '').trim();
    if (!href || href.charAt(0) !== '#') return;
    if (event.preventDefault) event.preventDefault();
    var id = href.slice(1);
    try { id = decodeURIComponent(id); } catch (err) {}
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) {
      var named = document.getElementsByName(id);
      target = named && named[0];
    }
    if (!target || !target.getBoundingClientRect) return;
    try {
      parent.postMessage({ type: ${JSON.stringify(HTML_PREVIEW_SCROLL_MESSAGE)}, y: target.getBoundingClientRect().top }, '*');
    } catch (err) {}
  }, true);
  if (typeof addEventListener === 'function') {
    addEventListener('message', function (event) {
      var payload = event && event.data;
      if (!payload || payload.type !== ${JSON.stringify(HTML_PREVIEW_FIND_MESSAGE)}) return;
      notesPreviewFind(payload);
    });
  }
}
${previewFindSource()}`
}

export function previewFindSource(): string {
  return `function notesPreviewFind(payload) {
  var query = String(payload && payload.query || '');
  var index = Number(payload && payload.index);
  var reveal = payload && payload.reveal !== false;
  var focus = payload && payload.focus === true;
  var root = document.body || document.documentElement;
  function reply(count, active, y) {
    try {
      parent.postMessage({ type: ${JSON.stringify(HTML_PREVIEW_FIND_RESULT_MESSAGE)}, count: count, index: active, y: y }, '*');
    } catch (err) {}
  }
  if (!root || !document.createTreeWalker) {
    reply(0, -1, 0);
    return;
  }
  var haystack = '';
  var walker = document.createTreeWalker(root, 4);
  var node;
  while ((node = walker.nextNode())) haystack += node.nodeValue || '';
  var needle = query.trim().toLowerCase();
  var matches = [];
  if (needle) {
    var text = haystack.toLowerCase();
    var from = 0;
    while (from <= text.length - needle.length) {
      var start = text.indexOf(needle, from);
      if (start === -1) break;
      matches.push([start, start + needle.length]);
      from = start + 1;
    }
  }
  var sel = document.getSelection && document.getSelection();
  if (!matches.length) {
    if (reveal && sel && sel.removeAllRanges) sel.removeAllRanges();
    reply(0, -1, 0);
    return;
  }
  var count = matches.length;
  var active = ((index % count) + count) % count;
  if (!reveal) {
    reply(count, active, 0);
    return;
  }
  var rangeStart = matches[active][0];
  var rangeEnd = matches[active][1];
  walker = document.createTreeWalker(root, 4);
  var offset = 0;
  var startNode = null;
  var startOff = 0;
  var endNode = null;
  var endOff = 0;
  while ((node = walker.nextNode())) {
    var len = (node.nodeValue || '').length;
    if (!startNode && rangeStart <= offset + len) {
      startNode = node;
      startOff = Math.max(0, rangeStart - offset);
    }
    if (rangeEnd <= offset + len) {
      endNode = node;
      endOff = Math.max(0, rangeEnd - offset);
      break;
    }
    offset += len;
  }
  if (!startNode || !endNode || !document.createRange) {
    reply(count, active, 0);
    return;
  }
  var range = document.createRange();
  range.setStart(startNode, Math.min(startOff, (startNode.nodeValue || '').length));
  range.setEnd(endNode, Math.min(endOff, (endNode.nodeValue || '').length));
  try {
    if (!document.getElementById('notes-find-style')) {
      var style = document.createElement('style');
      style.id = 'notes-find-style';
      style.textContent = '::highlight(notes-find){color:inherit;background-color:rgba(249,226,175,.85)}';
      (document.head || document.documentElement).appendChild(style);
    }
    if (window.CSS && CSS.highlights && window.Highlight) {
      CSS.highlights.set('notes-find', new Highlight(range));
    }
  } catch (err) {}
  if (focus) {
    if (sel && sel.removeAllRanges) sel.removeAllRanges();
    if (sel && sel.addRange) sel.addRange(range);
  }
  var mark = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
  var y = mark && mark.getBoundingClientRect ? mark.getBoundingClientRect().top : 0;
  reply(count, active, y);
}`
}

export function withPreviewBootstrap(html: string, storage: Record<string, string> = {}): string {
  const script = `<script data-notes-preview-runtime>(function(){${previewBootstrapSource()};notesPreviewBootstrap(${embedJson(storage)});})();</script>`
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (open) => `${open}${script}`)
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, (open) => `${open}${script}`)
  return `${script}${html}`
}

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

