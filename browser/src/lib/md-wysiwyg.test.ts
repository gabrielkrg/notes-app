import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { htmlToMd, mdToHtml, splitFrontmatter } from './md-wysiwyg.ts'

function roundTrip(body: string) {
  return htmlToMd(mdToHtml(body))
}

describe('splitFrontmatter', () => {
  it('leaves the YAML wrapper untouched and returns the body separately', () => {
    const raw = `---
title: Arrays
nav: Arrays
kind: topic
cue:
  - ordered hash maps
---

# Arrays

Maps, not C arrays.
`
    const { prefix, body } = splitFrontmatter(raw)
    assert.equal(
      prefix,
      `---
title: Arrays
nav: Arrays
kind: topic
cue:
  - ordered hash maps
---

`,
    )
    assert.equal(body, `# Arrays\n\nMaps, not C arrays.\n`)
    assert.equal(prefix + body, raw)
  })

  it('treats a file with no frontmatter as body only', () => {
    const raw = '# Arrays\n\nHello.\n'
    const { prefix, body } = splitFrontmatter(raw)
    assert.equal(prefix, '')
    assert.equal(body, raw)
  })
})

describe('mdToHtml / htmlToMd round-trip', () => {
  it('round-trips headings h1 through h3', () => {
    const body = '# Title\n\n## Section\n\n### Detail\n'
    assert.equal(roundTrip(body), body)
  })

  it('round-trips bold and italic', () => {
    const body = 'A **bold** word and an *italic* word.\n'
    assert.equal(roundTrip(body), body)
  })

  it('round-trips bullet and numbered lists', () => {
    const body = '- first\n- second\n\n1. alpha\n2. beta\n'
    assert.equal(roundTrip(body), body)
  })

  it('round-trips links', () => {
    const body = 'See [Laravel queues](../laravel/queues.md).\n'
    assert.equal(roundTrip(body), body)
  })

  it('round-trips inline code', () => {
    const body = 'Use `$arr[$key]` for O(1) lookup.\n'
    assert.equal(roundTrip(body), body)
  })

  it('round-trips fenced code blocks with a language', () => {
    const body = '```php\nforeach ($items as $item) {\n    echo $item;\n}\n```\n'
    assert.equal(roundTrip(body), body)
  })

  it('round-trips blockquotes', () => {
    const body = '> Big O describes time **and** memory.\n'
    assert.equal(roundTrip(body), body)
  })

  it('round-trips a horizontal rule', () => {
    const body = 'Before.\n\n---\n\nAfter.\n'
    assert.equal(roundTrip(body), body)
  })

  it('preserves markdown tables as raw blocks', () => {
    const body = `| Operation | Complexity |
|---|---|
| Access by key | O(1) |
| \`foreach\` | O(n) |
`
    assert.equal(roundTrip(body), body)
  })

  it('keeps a numbered list tight against the preceding paragraph', () => {
    const body = 'Use this shape:\n1. **Name it**\n2. **Explain why**\n'
    assert.equal(roundTrip(body), body)
  })

  it('round-trips one level of nested lists', () => {
    const body = `- parent
  - nested a
  - nested b
- sibling
`
    assert.equal(roundTrip(body), body)
  })
})
