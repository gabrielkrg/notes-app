import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  HTML_PREVIEW_HEIGHT_MESSAGE,
  HTML_PREVIEW_SANDBOX,
  collectPreviewAssetPaths,
  isHtmlPreviewHeightMessage,
  rewriteHtmlPreview,
  withPreviewHeightReporter,
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
