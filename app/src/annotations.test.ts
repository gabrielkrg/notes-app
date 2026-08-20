import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { rehypeAnnotate, type Annotation } from './annotations.ts'

type HastText = { type: 'text'; value: string }
type HastElement = {
  type: 'element'
  tagName: string
  properties?: Record<string, unknown>
  children: HastNode[]
}
type HastNode = HastText | HastElement | { type: string; children?: HastNode[] }

function text(value: string): HastText {
  return { type: 'text', value }
}

function el(tagName: string, children: HastNode[]): HastElement {
  return { type: 'element', tagName, children }
}

function highlight(exact: string): Annotation {
  return {
    id: 'ann-1',
    type: 'highlight',
    exact,
    prefix: '',
    suffix: '',
    text: '',
    createdAt: 0,
  }
}

function apply(tree: HastNode, exact: string) {
  rehypeAnnotate([highlight(exact)])(tree)
  return tree
}

function marks(node: HastNode, acc: HastElement[] = []): HastElement[] {
  if (node.type === 'element' && (node as HastElement).properties?.dataAnnId) {
    acc.push(node as HastElement)
  }
  for (const child of 'children' in node && node.children ? node.children : []) marks(child, acc)
  return acc
}

describe('rehypeAnnotate', () => {
  it('keeps a highlight through nested bold as one mark', () => {
    const tree = el('root', [
      el('p', [
        text('Big O describes '),
        el('strong', [text('time')]),
        text(' or memory. Senior answers mention both.'),
      ]),
    ])

    apply(tree, 'Big O describes time or memory. Senior answers mention both.')
    const found = marks(tree)
    assert.equal(found.length, 1)
    assert.equal(
      found[0].children.some((child) => child.type === 'element' && (child as HastElement).tagName === 'strong'),
      true,
    )
  })

  it('wraps each paragraph separately when the quote spans two blocks', () => {
    const tree = el('root', [
      el('p', [text('First sentence here.')]),
      el('p', [text('Second sentence there.')]),
    ])

    apply(tree, 'First sentence here. Second sentence there.')
    const found = marks(tree)
    assert.equal(found.length, 2)
    assert.equal(found[0].children.length, 1)
    assert.equal(found[1].children.length, 1)
  })

  it('still wraps a plain phrase in one mark', () => {
    const tree = el('root', [el('p', [text('Hello world from notes.')])])
    apply(tree, 'Hello world')
    const found = marks(tree)
    assert.equal(found.length, 1)
    assert.deepEqual(found[0].children, [text('Hello world')])
  })
})
