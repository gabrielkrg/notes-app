import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildContent,
  buildNoteGraph,
  dirForIndex,
  dirForRoute,
  groupLinkCounts,
  hrefForNode,
  isGraphRoute,
  overviewNodes,
  pageByRoute,
  resolveMdHref,
  routeFor,
} from './content-core.ts'

describe('buildContent', () => {
  const raw = {
    'php/index.md': '---\ntitle: PHP\nnav: PHP\n---\n\n# PHP\n',
    'php/arrays.md': '---\ntitle: Arrays\nnav: Arrays\n---\n\n# Arrays\n\nMaps, not C arrays.\n',
  }

  it('builds pages and a folder tree from relative markdown files', () => {
    const { pages, navTree, topicCount } = buildContent(raw)
    assert.equal(pages['php/arrays.md'].title, 'Arrays')
    assert.equal(navTree[0].type, 'dir')
    assert.equal(navTree[0].label, 'PHP')
    assert.equal(topicCount, 1)
    assert.equal(pageByRoute(pages, 'php/arrays')!.file, 'php/arrays.md')
  })

  it('accepts vite-style keys from the bundled glob', () => {
    const { pages } = buildContent({
      '../notes/laravel/queues.md': '---\ntitle: Queues\n---\n\n# Queues\n',
      '../../notes/php/arrays.md': '---\ntitle: Arrays\n---\n\n# Arrays\n',
    })
    assert.equal(pages['laravel/queues.md'].title, 'Queues')
    assert.equal(pages['php/arrays.md'].title, 'Arrays')
  })

  it('treats .txt files as notes with the same routing as markdown', () => {
    const { pages, topicCount } = buildContent({
      'php/index.md': '---\ntitle: PHP\n---\n',
      'php/test.txt': '---\ntitle: How to Structure Answers\nnav: How to structure answers\n---\n\n# How to Structure Answers\n',
    })
    assert.equal(pages['php/test.txt'].route, 'php/test')
    assert.equal(pages['php/test.txt'].title, 'How to Structure Answers')
    assert.equal(topicCount, 1)
    assert.equal(pageByRoute(pages, 'php/test')!.file, 'php/test.txt')
  })

  it('uses index.txt as a folder landing page', () => {
    const { pages, navTree } = buildContent({
      'scratch/index.txt': '---\ntitle: Scratch\nnav: Scratch\n---\n',
    })
    assert.equal(pages['scratch/index.txt'].isIndex, true)
    assert.equal(pages['scratch/index.txt'].route, 'scratch')
    assert.equal(navTree[0].label, 'Scratch')
    assert.equal(pageByRoute(pages, 'scratch')!.file, 'scratch/index.txt')
  })

  it('marks GitHub-sourced files as read-only', () => {
    const { pages, githubLabels } = buildContent(
      {
        'php/arrays.md': '---\ntitle: Arrays\n---\n',
        'handbook/README.md': '---\ntitle: Handbook\n---\n',
      },
      { githubFiles: ['handbook/README.md'] },
    )
    assert.equal(pages['handbook/README.md'].source, 'github')
    assert.equal(pages['handbook/README.md'].readonly, true)
    assert.equal(pages['php/arrays.md'].readonly, false)
    assert.deepEqual(githubLabels, ['handbook'])
  })

  it('shows GitHub roots as owner/repo', () => {
    const { navTree, githubNames } = buildContent(
      { 'gabrielkrg-skills/README.md': '# Skills\n' },
      {
        githubFiles: ['gabrielkrg-skills/README.md'],
        githubNames: { 'gabrielkrg-skills': 'gabrielkrg/skills' },
      },
    )
    assert.equal(githubNames['gabrielkrg-skills'], 'gabrielkrg/skills')
    assert.equal(navTree[0].label, 'gabrielkrg/skills')
    assert.equal(navTree[0].path, 'gabrielkrg-skills')
  })

  it('does not let a repo index page replace the owner/repo label', () => {
    const { navTree } = buildContent(
      {
        'gabrielkrg-skills/index.md': '---\ntitle: Skills\nnav: Skills\n---\n',
      },
      {
        githubFiles: ['gabrielkrg-skills/index.md'],
        githubNames: { 'gabrielkrg-skills': 'gabrielkrg/skills' },
      },
    )
    assert.equal(navTree[0].label, 'gabrielkrg/skills')
  })
})

describe('routeFor', () => {
  it('strips markdown and text extensions', () => {
    assert.equal(routeFor('php/arrays.md'), 'php/arrays')
    assert.equal(routeFor('php/test.txt'), 'php/test')
    assert.equal(routeFor('php/index.md'), 'php')
    assert.equal(routeFor('php/index.txt'), 'php')
  })
})

describe('resolveMdHref', () => {
  it('resolves .txt links the same way as .md', () => {
    const target = resolveMdHref('php/arrays.md', '../scratch/ideas.txt')
    assert.equal(target.kind, 'internal')
    assert.equal(target.route, 'scratch/ideas')
  })
})

describe('dirForIndex', () => {
  const raw = {
    'php/index.md': '---\ntitle: PHP\n---\n',
    'php/arrays.md': '---\ntitle: Arrays\n---\n',
    'php/security.md': '---\ntitle: Security\n---\n',
  }

  it('returns the folder children for a topic index page', () => {
    const { pages, navTree } = buildContent(raw)
    const folder = dirForIndex(navTree, pages['php/index.md'])
    assert.ok(folder)
    assert.equal(folder.path, 'php')
    assert.deepEqual(
      folder.children.map((node) => node.label).sort(),
      ['Arrays', 'Security'],
    )
  })

  it('returns null for a regular page', () => {
    const { pages, navTree } = buildContent(raw)
    assert.equal(dirForIndex(navTree, pages['php/arrays.md']), null)
  })
})

describe('isGraphRoute', () => {
  it('treats graph as the reserved global graph screen', () => {
    assert.equal(isGraphRoute('graph'), true)
    assert.equal(isGraphRoute('php/arrays'), false)
    assert.equal(isGraphRoute(''), false)
  })
})

describe('buildNoteGraph', () => {
  it('makes a node for every note, including isolates', () => {
    const { pages } = buildContent({
      'php/arrays.md': '# Arrays\n\nNo links here.\n',
      'php/oop.md': '# OOP\n',
    })
    const graph = buildNoteGraph(pages)
    const ids = graph.nodes.map((node) => node.id).sort()
    assert.deepEqual(ids, ['php/arrays.md', 'php/oop.md'])
    assert.equal(graph.edges.length, 0)
  })

  it('draws an edge when a note links to another note', () => {
    const { pages } = buildContent({
      'php/index.md': 'See [Arrays](arrays.md).\n',
      'php/arrays.md': '# Arrays\n',
    })
    const graph = buildNoteGraph(pages)
    assert.deepEqual(graph.edges, [{ source: 'php/index.md', target: 'php/arrays.md' }])
  })

  it('skips external urls, images, missing files, and duplicate links', () => {
    const { pages } = buildContent({
      'php/index.md': [
        '[Arrays](arrays.md)',
        '[Arrays again](arrays.md)',
        '[Site](https://example.com)',
        '![diagram](arrays.md)',
        '[Gone](missing.md)',
      ].join('\n'),
      'php/arrays.md': '# Arrays\n',
    })
    const graph = buildNoteGraph(pages)
    assert.deepEqual(graph.edges, [{ source: 'php/index.md', target: 'php/arrays.md' }])
  })

  it('colors nodes by top-level folder and keeps titles', () => {
    const { pages } = buildContent({
      'php/arrays.md': '---\ntitle: Arrays\nnav: Arrays\n---\n',
      'readme.md': '# Readme\n',
    })
    const graph = buildNoteGraph(pages)
    const byId = Object.fromEntries(graph.nodes.map((node) => [node.id, node]))
    assert.equal(byId['php/arrays.md'].group, 'php')
    assert.equal(byId['php/arrays.md'].title, 'Arrays')
    assert.equal(byId['php/arrays.md'].route, 'php/arrays')
    assert.equal(byId['readme.md'].group, '')
  })
})

describe('groupLinkCounts', () => {
  it('counts edges that touch each folder, including cross-folder links', () => {
    const { pages } = buildContent({
      'php/index.md': 'See [Arrays](arrays.md) and [Queues](../laravel/queues.md).\n',
      'php/arrays.md': '# Arrays\n',
      'laravel/queues.md': '# Queues\n',
    })
    const counts = groupLinkCounts(buildNoteGraph(pages))
    assert.equal(counts.get('php'), 2)
    assert.equal(counts.get('laravel'), 1)
  })
})

describe('dirForRoute', () => {
  const raw = {
    'notes/php/arrays.md': '# Arrays\n',
    'notes/laravel/queues.md': '# Queues\n',
    'skills/git.md': '# Git\n',
  }

  it('finds a folder even when it has no index.md', () => {
    const { navTree } = buildContent(raw)
    const folder = dirForRoute(navTree, 'notes')
    assert.ok(folder)
    assert.equal(folder.path, 'notes')
    assert.deepEqual(
      folder.children.filter((node) => node.type === 'dir').map((node) => node.path).sort(),
      ['notes/laravel', 'notes/php'],
    )
  })

  it('returns null for the dashboard and missing folders', () => {
    const { navTree } = buildContent(raw)
    assert.equal(dirForRoute(navTree, ''), null)
    assert.equal(dirForRoute(navTree, 'missing'), null)
  })
})

describe('hrefForNode', () => {
  it('opens a folder at its own path when it has no index', () => {
    const { navTree } = buildContent({
      'notes/php/arrays.md': '# Arrays\n',
    })
    assert.equal(hrefForNode(navTree[0]), 'notes')
  })

  it('opens a folder with index.md at the folder path', () => {
    const { navTree } = buildContent({
      'php/index.md': '# PHP\n',
      'php/arrays.md': '# Arrays\n',
    })
    assert.equal(hrefForNode(navTree[0]), 'php')
  })

  it('opens a page at its note route', () => {
    const { navTree } = buildContent({
      'readme.md': '# Readme\n',
    })
    assert.equal(hrefForNode(navTree[0]), 'readme')
  })
})

describe('overviewNodes', () => {
  const raw = {
    'notes/php/arrays.md': '# Arrays\n',
    'notes/laravel/queues.md': '# Queues\n',
    'skills/git.md': '# Git\n',
  }

  it('shows included root folders on the dashboard', () => {
    const { navTree } = buildContent(raw)
    assert.deepEqual(
      overviewNodes(navTree, '').map((node) => node.path).sort(),
      ['notes', 'skills'],
    )
  })

  it('shows the folders inside a directory that has no index.md', () => {
    const { navTree } = buildContent(raw)
    assert.deepEqual(
      overviewNodes(navTree, 'notes')
        .filter((node) => node.type === 'dir')
        .map((node) => node.path)
        .sort(),
      ['notes/laravel', 'notes/php'],
    )
  })
})
