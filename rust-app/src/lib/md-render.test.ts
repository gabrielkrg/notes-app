import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'node:test'
import ReactMarkdown from 'react-markdown'

import { markdownRemarkPlugins } from './md-render.ts'

function render(markdown: string) {
  return renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: markdownRemarkPlugins }, markdown),
  )
}

describe('markdownRemarkPlugins', () => {
  it('turns a single newline into a line break', () => {
    const html = render('kriativa\nIlluminsight\nlighthouse')
    assert.match(html, /kriativa<br\/?>\s*Illuminsight<br\/?>\s*lighthouse/)
  })

  it('still treats a blank line as a new paragraph', () => {
    const html = render('lighthouse\n\ntest')
    assert.match(html, /<p>lighthouse<\/p>\s*<p>test<\/p>/)
  })

  it('turns [~] list items into task list items', () => {
    const html = render('- [~] seeded')
    assert.match(html, /task-list-item/)
    assert.doesNotMatch(html, /\[~\]/)
  })
})
