import assert from 'node:assert/strict'
import { it } from 'node:test'
import { navigationShortcut } from './navigation-shortcuts.ts'

it('matches navigation shortcuts with Ctrl and Cmd, including while typing', () => {
  for (const modifier of ['ctrlKey', 'metaKey']) {
    for (const [key, shiftKey, action] of [
      ['e', false, 'menu'],
      ['/', false, 'guide'],
      ['d', false, 'bookmark'],
      ['G', true, 'graph'],
      ['B', true, 'bookmarks'],
    ] as const) {
      assert.equal(navigationShortcut({ key, shiftKey, [modifier]: true }, true), action)
    }
    assert.equal(navigationShortcut({ key: 'e', [modifier]: true, altKey: true }), null)
    assert.equal(navigationShortcut({ key: 'e', [modifier]: true, shiftKey: true }), null)
    assert.equal(navigationShortcut({ key: 'b', [modifier]: true }), null)
    assert.equal(navigationShortcut({ key: 'k', [modifier]: true }), null)
  }
})

it('keeps plain letters available for typing and requires Alt for Home', () => {
  assert.equal(navigationShortcut({ key: '?' }), 'guide')
  assert.equal(navigationShortcut({ key: '?' }, true), null)
  assert.equal(navigationShortcut({ key: '/' }), null)
  assert.equal(navigationShortcut({ key: 'e' }), null)
  assert.equal(navigationShortcut({ key: 'Home' }), null)
  assert.equal(navigationShortcut({ key: 'Home', altKey: true }), 'dashboard')
})
