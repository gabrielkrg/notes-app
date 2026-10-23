import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import vm from 'node:vm'

import {
  HTML_PREVIEW_FIND_MESSAGE,
  HTML_PREVIEW_FIND_RESULT_MESSAGE,
  HTML_PREVIEW_HEIGHT_MESSAGE,
  HTML_PREVIEW_SANDBOX,
  HTML_PREVIEW_SCROLL_MESSAGE,
  HTML_PREVIEW_STORAGE_MESSAGE,
  collectPreviewAssetPaths,
  isHtmlPreviewFindMessage,
  isHtmlPreviewFindResultMessage,
  isHtmlPreviewHeightMessage,
  isHtmlPreviewScrollMessage,
  isHtmlPreviewStorageMessage,
  previewBootstrapSource,
  previewStorageKey,
  readPreviewStorage,
  rewriteHtmlPreview,
  scrollOffsetForPreview,
  withPreviewBootstrap,
  withPreviewHeightReporter,
  writePreviewStorage,
} from './html-preview.ts'

describe('HTML_PREVIEW_SANDBOX', () => {
  it('allows scripts without sharing the parent origin', () => {
    assert.equal(HTML_PREVIEW_SANDBOX, 'allow-scripts')
    assert.equal(HTML_PREVIEW_SANDBOX.includes('allow-same-origin'), false)
    assert.equal(HTML_PREVIEW_SANDBOX.includes('allow-top-navigation'), false)
    assert.equal(HTML_PREVIEW_SANDBOX.includes('allow-popups'), false)
  })
})

describe('rewriteHtmlPreview', () => {
  const pages = {
    'php/widget.html': '<link rel="stylesheet" href="theme.css"><script src="main.js"></script>',
    'php/theme.css': 'body { color: red; background: url(logo.png); }',
    'php/main.js': 'console.log("hi")',
  }

  it('inlines a relative stylesheet and script from the notes map', () => {
    const html = rewriteHtmlPreview('php/widget.html', pages['php/widget.html'], pages)
    assert.match(html, /<style[^>]*>body \{ color: red;/)
    assert.match(html, /<script[^>]*>console\.log\("hi"\)<\/script>/)
    assert.equal(html.includes('href="theme.css"'), false)
    assert.equal(html.includes('src="main.js"'), false)
  })

  it('leaves external urls and missing siblings alone', () => {
    const raw = [
      '<link rel="stylesheet" href="https://example.com/a.css">',
      '<script src="missing.js"></script>',
      '<a href="mailto:a@b.c">mail</a>',
      '<div id="top"></div><a href="#top">jump</a>',
    ].join('')
    const html = rewriteHtmlPreview('php/widget.html', raw, pages)
    assert.match(html, /href="https:\/\/example.com\/a.css"/)
    assert.match(html, /src="missing.js"/)
    assert.match(html, /href="mailto:a@b.c"/)
    assert.match(html, /href="#top"/)
  })

  it('rewrites css url() and img src through loadAsset', () => {
    const loadAsset = (file: string) => (file === 'php/logo.png' ? 'data:image/png;base64,abc' : null)
    const html = rewriteHtmlPreview(
      'php/widget.html',
      '<link rel="stylesheet" href="theme.css"><img src="logo.png">',
      pages,
      loadAsset,
    )
    assert.match(html, /url\("data:image\/png;base64,abc"\)/)
    assert.match(html, /src="data:image\/png;base64,abc"/)
  })

  it('does not rewrite javascript: urls', () => {
    const html = rewriteHtmlPreview('php/widget.html', '<img src="javascript:alert(1)">', pages)
    assert.match(html, /src="javascript:alert\(1\)"/)
  })

  it('collects relative image paths from html and linked css', () => {
    const paths = collectPreviewAssetPaths(
      'php/widget.html',
      '<link rel="stylesheet" href="theme.css"><img src="hero.jpg">',
      pages,
    )
    assert.deepEqual(paths.sort(), ['php/hero.jpg', 'php/logo.png'])
  })
})

describe('withPreviewHeightReporter', () => {
  it('injects a height reporter before </body>', () => {
    const html = withPreviewHeightReporter('<body><p>hi</p></body>')
    assert.match(html, /data-notes-preview-height/)
    assert.match(html, new RegExp(`${HTML_PREVIEW_HEIGHT_MESSAGE}[\\s\\S]*</body>`))
    assert.equal(html.endsWith('</body>'), true)
  })

  it('appends the reporter when there is no body tag', () => {
    const html = withPreviewHeightReporter('<p>hi</p>')
    assert.match(html, /<p>hi<\/p>[\s\S]*data-notes-preview-height/)
  })
})

describe('isHtmlPreviewHeightMessage', () => {
  it('accepts a finite non-negative height from the preview iframe', () => {
    assert.equal(
      isHtmlPreviewHeightMessage({ type: HTML_PREVIEW_HEIGHT_MESSAGE, height: 840 }),
      true,
    )
  })

  it('rejects other postMessage payloads', () => {
    assert.equal(isHtmlPreviewHeightMessage({ type: HTML_PREVIEW_HEIGHT_MESSAGE, height: -1 }), false)
    assert.equal(isHtmlPreviewHeightMessage({ type: 'other', height: 100 }), false)
    assert.equal(isHtmlPreviewHeightMessage('notes-html-preview-height'), false)
  })
})

describe('preview storage', () => {
  it('round-trips a per-file snapshot through a storage-like bag', () => {
    const bag: Record<string, string> = {}
    const storage = {
      getItem: (key: string) => (key in bag ? bag[key] : null),
      setItem: (key: string, value: string) => {
        bag[key] = value
      },
    }
    writePreviewStorage('taiwan trip/index.html', { taiwan2026: '{"checks":{"spot:foo":true}}' }, storage)
    assert.equal(bag[previewStorageKey('taiwan trip/index.html')] != null, true)
    assert.deepEqual(readPreviewStorage('taiwan trip/index.html', storage), {
      taiwan2026: '{"checks":{"spot:foo":true}}',
    })
    assert.deepEqual(readPreviewStorage('other.html', storage), {})
  })

  it('ignores malformed snapshots', () => {
    const storage = { getItem: () => 'not-json', setItem: () => {} }
    assert.deepEqual(readPreviewStorage('x.html', storage), {})
  })
})

describe('withPreviewBootstrap', () => {
  it('injects a runtime in head before later scripts, with the storage snapshot', () => {
    const html = withPreviewBootstrap(
      '<html><head><title>T</title></head><body><script src="app.js"></script></body></html>',
      { taiwan2026: '{"checks":{"a":true}}' },
    )
    const runtimeAt = html.indexOf('data-notes-preview-runtime')
    const appAt = html.indexOf('src="app.js"')
    assert.equal(runtimeAt >= 0, true)
    assert.equal(runtimeAt < appAt, true)
    assert.match(html, /<head[^>]*>[\s\S]*data-notes-preview-runtime/)
    assert.match(html, /"taiwan2026":"\{\\"checks\\":\{\\"a\\":true\}\}"/)
    assert.match(html, new RegExp(HTML_PREVIEW_STORAGE_MESSAGE))
    assert.match(html, new RegExp(HTML_PREVIEW_SCROLL_MESSAGE))
  })

  it('prepends the runtime when there is no head tag', () => {
    const html = withPreviewBootstrap('<p>hi</p>', {})
    assert.match(html, /^<script data-notes-preview-runtime>/)
  })
})

describe('preview bootstrap runtime', () => {
  function runBootstrap(initial: Record<string, string>) {
    const posted: unknown[] = []
    const listeners: Array<(event: { target: unknown }) => void> = []
    const windowObj: Record<string, unknown> = {}
    const context = {
      window: windowObj,
      document: {
        addEventListener: (_type: string, fn: (event: { target: unknown }) => void) => {
          listeners.push(fn)
        },
        getElementById: (id: string) =>
          id === 'days' ? { getBoundingClientRect: () => ({ top: 420 }) } : null,
        getElementsByName: () => [],
      },
      parent: {
        postMessage: (data: unknown) => {
          posted.push(data)
        },
      },
      Object,
      String,
    }
    windowObj.window = windowObj
    vm.runInNewContext(
      `${previewBootstrapSource()}; notesPreviewBootstrap(${JSON.stringify(initial)})`,
      context,
    )
    return {
      localStorage: windowObj.localStorage as Storage,
      sessionStorage: windowObj.sessionStorage as Storage,
      posted,
      click: (event: { target: unknown; preventDefault?: () => void }) => {
        for (const fn of listeners) fn(event)
      },
    }
  }

  it('restores localStorage and posts updates for the parent to persist', () => {
    const runtime = runBootstrap({ taiwan2026: '{"checks":{"spot:foo":true}}' })
    assert.equal(runtime.localStorage.getItem('taiwan2026'), '{"checks":{"spot:foo":true}}')
    runtime.localStorage.setItem('taiwan2026', '{"checks":{"spot:foo":true,"spot:bar":true}}')
    const last = runtime.posted.at(-1)
    assert.equal(isHtmlPreviewStorageMessage(last), true)
    if (isHtmlPreviewStorageMessage(last)) {
      assert.equal(last.data.taiwan2026, '{"checks":{"spot:foo":true,"spot:bar":true}}')
    }
  })

  it('prevents hash navigation and asks the parent to scroll to the target', () => {
    const runtime = runBootstrap({})
    const preventCalls: string[] = []
    const anchor = {
      nodeType: 1,
      tagName: 'A',
      parentNode: null,
      getAttribute: (name: string) => (name === 'href' ? '#days' : null),
    }
    runtime.click({
      target: anchor,
      preventDefault: () => {
        preventCalls.push('prevent')
      },
    })
    assert.deepEqual(preventCalls, ['prevent'])
    const last = runtime.posted.at(-1)
    assert.equal(isHtmlPreviewScrollMessage(last), true)
    if (isHtmlPreviewScrollMessage(last)) assert.equal(last.y, 420)
  })
})

describe('isHtmlPreviewStorageMessage', () => {
  it('accepts a string map from the preview iframe', () => {
    assert.equal(
      isHtmlPreviewStorageMessage({
        type: HTML_PREVIEW_STORAGE_MESSAGE,
        data: { taiwan2026: '{}' },
      }),
      true,
    )
  })

  it('rejects other payloads', () => {
    assert.equal(isHtmlPreviewStorageMessage({ type: HTML_PREVIEW_STORAGE_MESSAGE, data: 1 }), false)
    assert.equal(isHtmlPreviewStorageMessage({ type: HTML_PREVIEW_HEIGHT_MESSAGE, height: 1 }), false)
  })
})

describe('isHtmlPreviewScrollMessage', () => {
  it('accepts a finite y offset from the preview iframe', () => {
    assert.equal(isHtmlPreviewScrollMessage({ type: HTML_PREVIEW_SCROLL_MESSAGE, y: 420 }), true)
  })

  it('rejects other payloads', () => {
    assert.equal(isHtmlPreviewScrollMessage({ type: HTML_PREVIEW_SCROLL_MESSAGE, y: Infinity }), false)
    assert.equal(isHtmlPreviewScrollMessage({ type: HTML_PREVIEW_HEIGHT_MESSAGE, height: 1 }), false)
  })
})

describe('scrollOffsetForPreview', () => {
  it('maps an iframe-local y to the parent scroller', () => {
    assert.equal(scrollOffsetForPreview(80, 0, 200, 420), 700)
  })
})

describe('html preview find messages', () => {
  it('accepts a query and index for the preview iframe', () => {
    assert.equal(isHtmlPreviewFindMessage({ type: HTML_PREVIEW_FIND_MESSAGE, query: 'hello', index: 0 }), true)
    assert.equal(isHtmlPreviewFindMessage({ type: HTML_PREVIEW_FIND_MESSAGE, query: 'hello' }), false)
  })

  it('accepts a find result from the preview iframe', () => {
    assert.equal(
      isHtmlPreviewFindResultMessage({ type: HTML_PREVIEW_FIND_RESULT_MESSAGE, count: 2, index: 1, y: 40 }),
      true,
    )
    assert.equal(
      isHtmlPreviewFindResultMessage({ type: HTML_PREVIEW_FIND_RESULT_MESSAGE, count: -1, index: 0, y: 0 }),
      false,
    )
  })

  it('embeds find commands in the preview bootstrap', () => {
    const source = previewBootstrapSource()
    assert.match(source, new RegExp(HTML_PREVIEW_FIND_MESSAGE))
    assert.match(source, new RegExp(HTML_PREVIEW_FIND_RESULT_MESSAGE))
    assert.match(source, /payload\.reveal !== false/)
    assert.match(source, /payload\.focus === true/)
  })

  it('accepts an optional reveal flag on find messages', () => {
    assert.equal(
      isHtmlPreviewFindMessage({ type: HTML_PREVIEW_FIND_MESSAGE, query: 'hello', index: 0, reveal: false }),
      true,
    )
    assert.equal(
      isHtmlPreviewFindMessage({ type: HTML_PREVIEW_FIND_MESSAGE, query: 'hello', index: 0, reveal: 'no' }),
      false,
    )
  })
})
