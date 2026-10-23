import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  matchesNoteMeta,
  searchNoteContents,
  shouldSearchContent,
  type SearchableNote,
} from './search-notes.ts'

function note(partial: Partial<SearchableNote> & { body?: string }): SearchableNote {
  const title = partial.title ?? 'Untitled'
  return {
    file: partial.file ?? `${title.toLowerCase().replace(/\s+/g, '-')}.md`,
    route: partial.route ?? title.toLowerCase().replace(/\s+/g, '-'),
    title,
    navLabel: partial.navLabel,
    body: partial.body ?? '',
  }
}

describe('shouldSearchContent', () => {
  it('waits until the query has two non-space characters', () => {
    assert.equal(shouldSearchContent(''), false)
    assert.equal(shouldSearchContent(' a '), false)
    assert.equal(shouldSearchContent('ab'), true)
  })
})

describe('matchesNoteMeta', () => {
  it('matches title, label, route, or file case-insensitively', () => {
    const page = note({
      file: 'work/sql/indexing.md',
      route: 'work/sql/indexing',
      title: 'Indexing',
      navLabel: 'SQL Indexing',
    })
    assert.equal(matchesNoteMeta(page, ''), true)
    assert.equal(matchesNoteMeta(page, 'INDEX'), true)
    assert.equal(matchesNoteMeta(page, 'sql/'), true)
    assert.equal(matchesNoteMeta(page, 'queues'), false)
  })
})

describe('searchNoteContents', () => {
  it('returns nothing until the query is long enough', () => {
    const pages = [note({ title: 'Jobs', body: 'Look at openings today' })]
    assert.deepEqual(searchNoteContents(pages, 'o'), [])
  })

  it('finds a note by body text and keeps a snippet around the match', () => {
    const pages = [
      note({
        title: 'Jobs',
        file: 'Documents/jobs.txt',
        route: 'Documents/jobs',
        body: 'Monday notes.\nLook at backend openings today.\nThen write.',
      }),
      note({ title: 'Queues', body: 'Workers and jobs in Laravel.' }),
    ]

    const hits = searchNoteContents(pages, 'OPENINGS')
    assert.equal(hits.length, 1)
    assert.equal(hits[0].file, 'Documents/jobs.txt')
    assert.equal(hits[0].route, 'Documents/jobs')
    assert.equal(hits[0].title, 'Jobs')
    assert.match(hits[0].snippet, /openings/i)
    assert.match(hits[0].snippet, /backend/i)
  })

  it('caps how many body matches are returned', () => {
    const pages = Array.from({ length: 40 }, (_, index) =>
      note({ title: `Note ${index}`, file: `n${index}.md`, route: `n${index}`, body: 'needle in here' }),
    )
    assert.equal(searchNoteContents(pages, 'needle').length, 30)
  })
})
