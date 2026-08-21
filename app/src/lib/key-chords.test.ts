import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { CtrlKChord, isNewNoteShortcut } from './key-chords.ts'

function keyEvent({ key, ctrlKey = false, metaKey = false }: { key: string; ctrlKey?: boolean; metaKey?: boolean }) {
  return {
    key,
    ctrlKey,
    metaKey,
    preventDefault() {
      this.prevented = true
    },
    prevented: false,
  }
}

describe('CtrlKChord', () => {
  it('opens search after Ctrl+K if no second key arrives', () => {
    mock.timers.enable({ apis: ['setTimeout'] })
    const chord = new CtrlKChord()
    const calls: string[] = []
    const event = keyEvent({ key: 'k', ctrlKey: true })

    assert.equal(chord.handle(event, { onSearch: () => calls.push('search'), onOpenFolder: () => calls.push('folder') }), 'pending')
    assert.equal(event.prevented, true)
    assert.deepEqual(calls, [])

    mock.timers.tick(500)
    assert.deepEqual(calls, ['search'])
    chord.dispose()
    mock.timers.reset()
  })

  it('opens a folder on Ctrl+K then Ctrl+O', () => {
    mock.timers.enable({ apis: ['setTimeout'] })
    const chord = new CtrlKChord()
    const calls: string[] = []
    const handlers = {
      onSearch: () => calls.push('search'),
      onOpenFolder: () => calls.push('folder'),
    }

    chord.handle(keyEvent({ key: 'k', ctrlKey: true }), handlers)
    const second = keyEvent({ key: 'o', ctrlKey: true })
    assert.equal(chord.handle(second, handlers), 'folder')
    assert.equal(second.prevented, true)
    assert.deepEqual(calls, ['folder'])

    mock.timers.tick(500)
    assert.deepEqual(calls, ['folder'])
    chord.dispose()
    mock.timers.reset()
  })

  it('closes search immediately on Ctrl+K when search is already open', () => {
    const chord = new CtrlKChord()
    const calls: string[] = []
    const event = keyEvent({ key: 'k', ctrlKey: true })

    assert.equal(
      chord.handle(event, {
        searchOpen: true,
        onSearch: () => calls.push('search'),
        onOpenFolder: () => calls.push('folder'),
      }),
      'search',
    )
    assert.deepEqual(calls, ['search'])
    chord.dispose()
  })
})

describe('isNewNoteShortcut', () => {
  it('matches Ctrl+N and Cmd+N', () => {
    assert.equal(isNewNoteShortcut(keyEvent({ key: 'n', ctrlKey: true })), true)
    assert.equal(isNewNoteShortcut(keyEvent({ key: 'N', metaKey: true })), true)
  })

  it('ignores N without a modifier and other chords', () => {
    assert.equal(isNewNoteShortcut(keyEvent({ key: 'n' })), false)
    assert.equal(isNewNoteShortcut(keyEvent({ key: 'k', ctrlKey: true })), false)
  })
})
