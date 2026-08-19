import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  attachedRootForDir,
  labelNotesRoots,
  mergeRootPages,
  parseNotesRootEnv,
  resolveVirtualNote,
  rootsFromSettings,
} from './notes-roots.ts'

describe('parseNotesRootEnv', () => {
  it('returns a single trimmed path', () => {
    assert.deepEqual(parseNotesRootEnv(' /home/me/notes '), ['/home/me/notes'])
  })

  it('splits comma-separated paths', () => {
    assert.deepEqual(parseNotesRootEnv('/home/me/notes,/home/me/work'), [
      '/home/me/notes',
      '/home/me/work',
    ])
  })

  it('drops empty segments', () => {
    assert.deepEqual(parseNotesRootEnv('/home/me/notes, , /tmp/extra,'), [
      '/home/me/notes',
      '/tmp/extra',
    ])
  })
})

describe('labelNotesRoots', () => {
  it('uses the folder name as the label', () => {
    assert.deepEqual(labelNotesRoots(['/home/me/notes', '/home/me/work']), [
      { root: '/home/me/notes', label: 'notes' },
      { root: '/home/me/work', label: 'work' },
    ])
  })

  it('suffixes duplicate folder names', () => {
    const labeled = labelNotesRoots(['/a/notes', '/b/notes', '/c/notes'])
    assert.deepEqual(
      labeled.map((item) => item.label),
      ['notes', 'notes-2', 'notes-3'],
    )
  })
})

describe('mergeRootPages', () => {
  it('keeps relative keys unprefixed for a single root', () => {
    const pages = mergeRootPages([
      {
        root: '/home/me/notes',
        files: {
          '/home/me/notes/php/arrays.md': '# Arrays',
        },
      },
    ])
    assert.deepEqual(pages, { 'php/arrays.md': '# Arrays' })
  })

  it('prefixes keys with the folder name when there are multiple roots', () => {
    const pages = mergeRootPages([
      {
        root: '/home/me/notes',
        files: { '/home/me/notes/php/arrays.md': '# Arrays' },
      },
      {
        root: '/home/me/work',
        files: { '/home/me/work/sql/indexing.md': '# Indexing' },
      },
    ])
    assert.equal(pages['notes/php/arrays.md'], '# Arrays')
    assert.equal(pages['work/sql/indexing.md'], '# Indexing')
    assert.equal(pages['php/arrays.md'], undefined)
  })

  it('strips vite-style relative glob keys', () => {
    const pages = mergeRootPages([
      {
        root: '/repo/notes',
        files: { '../../notes/php/arrays.md': '# Arrays' },
      },
    ])
    assert.equal(pages['php/arrays.md'], '# Arrays')
  })

  it('keeps a relative path that contains the folder name', () => {
    const pages = mergeRootPages([
      {
        root: '/home/me/notes',
        files: { 'php/notes/foo.md': '# Foo' },
      },
    ])
    assert.equal(pages['php/notes/foo.md'], '# Foo')
  })
})

describe('resolveVirtualNote', () => {
  const one = labelNotesRoots(['/home/me/notes'])
  const many = labelNotesRoots(['/home/me/notes', '/home/me/work'])

  it('maps a path onto the only root', () => {
    assert.deepEqual(resolveVirtualNote('php/arrays.md', one), {
      root: '/home/me/notes',
      label: 'notes',
      relative: 'php/arrays.md',
    })
  })

  it('maps a prefixed path onto the matching root', () => {
    assert.deepEqual(resolveVirtualNote('work/sql/indexing.md', many), {
      root: '/home/me/work',
      label: 'work',
      relative: 'sql/indexing.md',
    })
  })

  it('rejects a note that is not inside a vault when there are multiple roots', () => {
    assert.throws(() => resolveVirtualNote('loose.md', many), /notes folder/i)
    assert.throws(() => resolveVirtualNote('', many), /notes folder/i)
  })
})

describe('attachedRootForDir', () => {
  it('returns null when a single folder is attached', () => {
    assert.equal(attachedRootForDir(['/home/me/notes'], 'php'), null)
  })

  it('maps a top-level group onto the attached folder', () => {
    assert.equal(
      attachedRootForDir(['/home/me/notes', '/home/me/work'], 'work'),
      '/home/me/work',
    )
  })

  it('returns null for nested folders', () => {
    assert.equal(
      attachedRootForDir(['/home/me/notes', '/home/me/work'], 'work/sql'),
      null,
    )
  })
})

describe('rootsFromSettings', () => {
  it('prefers notesRoots when present', () => {
    assert.deepEqual(
      rootsFromSettings({ notesRoots: ['/a/notes', '/b/work'], notesRoot: '/old' }),
      ['/a/notes', '/b/work'],
    )
  })

  it('migrates a single notesRoot', () => {
    assert.deepEqual(rootsFromSettings({ notesRoot: '/home/me/notes' }), ['/home/me/notes'])
  })

  it('returns an empty list when unset', () => {
    assert.deepEqual(rootsFromSettings({}), [])
  })
})
