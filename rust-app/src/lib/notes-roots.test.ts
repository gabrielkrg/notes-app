import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  attachedRootForDir,
  createParentPath,
  defaultNotesRootFromSettings,
  labelForRoot,
  labelNotesRoots,
  mergeRootPages,
  parseNotesRootEnv,
  persistableDefaultNotesRoot,
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
  it('prefixes keys with the folder name for a single root', () => {
    const pages = mergeRootPages([
      {
        root: '/home/me/notes',
        files: {
          '/home/me/notes/php/arrays.md': '# Arrays',
        },
      },
    ])
    assert.deepEqual(pages, { 'notes/php/arrays.md': '# Arrays' })
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
    assert.equal(pages['notes/php/arrays.md'], '# Arrays')
  })

  it('keeps a relative path that contains the folder name', () => {
    const pages = mergeRootPages([
      {
        root: '/home/me/notes',
        files: { 'php/notes/foo.md': '# Foo' },
      },
    ])
    assert.equal(pages['notes/php/notes/foo.md'], '# Foo')
  })
})

describe('resolveVirtualNote', () => {
  const one = labelNotesRoots(['/home/me/notes'])
  const many = labelNotesRoots(['/home/me/notes', '/home/me/work'])

  it('maps a prefixed path onto the only root', () => {
    assert.deepEqual(resolveVirtualNote('notes/php/arrays.md', one), {
      root: '/home/me/notes',
      label: 'notes',
      relative: 'php/arrays.md',
    })
  })

  it('rejects a note that is not inside the vault when there is a single root', () => {
    assert.throws(() => resolveVirtualNote('php/arrays.md', one), /notes folder/i)
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
  it('maps a single attached folder onto its top-level group', () => {
    assert.equal(attachedRootForDir(['/home/me/notes'], 'notes'), '/home/me/notes')
  })

  it('returns null for children inside a single attached folder', () => {
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

describe('defaultNotesRootFromSettings', () => {
  const notes = '/home/me/notes'
  const work = '/home/me/work'

  it('returns the saved default when it is still attached', () => {
    assert.equal(
      defaultNotesRootFromSettings({ defaultNotesRoot: work }, [notes, work]),
      work,
    )
  })

  it('treats a trailing slash as the same folder', () => {
    assert.equal(
      defaultNotesRootFromSettings({ defaultNotesRoot: `${notes}/` }, [notes]),
      notes,
    )
  })

  it('falls back to the only attached folder when the default is unset', () => {
    assert.equal(defaultNotesRootFromSettings({}, [notes]), notes)
  })

  it('clears a default that is no longer attached when several folders remain', () => {
    assert.equal(
      defaultNotesRootFromSettings({ defaultNotesRoot: '/gone' }, [notes, work]),
      '',
    )
  })

  it('falls back to the remaining folder after the default is removed', () => {
    assert.equal(
      defaultNotesRootFromSettings({ defaultNotesRoot: work }, [notes]),
      notes,
    )
  })

  it('returns empty when nothing is attached', () => {
    assert.equal(defaultNotesRootFromSettings({ defaultNotesRoot: notes }, []), '')
  })
})

describe('persistableDefaultNotesRoot', () => {
  const notes = '/home/me/notes'
  const work = '/home/me/work'
  const extra = '/home/me/extra'

  it('saves the implicit default when a second folder is attached', () => {
    assert.equal(
      persistableDefaultNotesRoot({ notesRoots: [notes] }, [notes, work]),
      notes,
    )
  })

  it('keeps an explicit default while another folder is added', () => {
    assert.equal(
      persistableDefaultNotesRoot({ notesRoots: [notes, work], defaultNotesRoot: work }, [notes, work, extra]),
      work,
    )
  })

  it('clears a removed default when several folders remain', () => {
    assert.equal(
      persistableDefaultNotesRoot(
        { notesRoots: [notes, work, extra], defaultNotesRoot: extra },
        [notes, work],
      ),
      '',
    )
  })
})

describe('labelForRoot', () => {
  it('returns the sidebar label for an attached folder', () => {
    assert.equal(labelForRoot(['/home/me/notes', '/home/me/work'], '/home/me/work'), 'work')
  })

  it('returns empty when the folder is not attached', () => {
    assert.equal(labelForRoot(['/home/me/notes'], '/home/me/work'), '')
  })
})

describe('createParentPath', () => {
  const roots = ['/home/me/notes', '/home/me/work']

  it('keeps an explicit parent folder', () => {
    assert.equal(createParentPath('notes/php', roots, '/home/me/notes'), 'notes/php')
  })

  it('uses the default vault label when parent is empty', () => {
    assert.equal(createParentPath('', roots, '/home/me/work'), 'work')
  })

  it('returns empty when there is no default and parent is empty', () => {
    assert.equal(createParentPath('', roots, ''), '')
  })
})
