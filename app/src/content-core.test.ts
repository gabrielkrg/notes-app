import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildContent,
  buildNoteGraph,
  dirForIndex,
  dirForRoute,
  groupLinkCounts,
  hoistNavRoot,
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

  it('treats html, css, and js as notes', () => {
    const { pages } = buildContent({
      'php/widget.html': '<!doctype html><title>Widget</title><h1>Widget</h1>',
      'php/theme.css': 'body { color: red; }',
      'php/main.js': 'console.log(1)',
    })
    assert.equal(pages['php/widget.html'].route, 'php/widget')
    assert.equal(pages['php/widget.html'].title, 'Widget')
    assert.equal(pages['php/theme.css'].route, 'php/theme')
    assert.equal(pages['php/theme.css'].title, 'Theme')
    assert.equal(pages['php/main.js'].title, 'Main')
    assert.equal(pageByRoute(pages, 'php/widget')!.file, 'php/widget.html')
  })

  it('uses index.html as a folder landing page', () => {
    const { pages, navTree } = buildContent({
      'demo/index.html': '<title>Demo</title>',
    })
    assert.equal(pages['demo/index.html'].isIndex, true)
    assert.equal(pages['demo/index.html'].route, 'demo')
    assert.equal(navTree[0].label, 'Demo')
    assert.equal(pageByRoute(pages, 'demo')!.file, 'demo/index.html')
  })

  it('prefers markdown when two files share a route', () => {
    const { pages } = buildContent({
      'php/widget.html': '<title>HTML Widget</title>',
      'php/widget.md': '---\ntitle: MD Widget\n---\n',
    })
    assert.equal(pageByRoute(pages, 'php/widget')!.file, 'php/widget.md')
    assert.equal(pages['php/widget.html'].title, 'HTML Widget')
  })

  it('prefers index.md over index.html as the folder landing', () => {
    const { pages } = buildContent({
      'demo/index.html': '<title>HTML Demo</title>',
      'demo/index.md': '---\ntitle: MD Demo\n---\n',
    })
    assert.equal(pageByRoute(pages, 'demo')!.file, 'demo/index.md')
  })

  it('takes html title from the first h1 when title is missing', () => {
    const { pages } = buildContent({
      'php/widget.html': '<h1>Heading Only</h1>',
    })
    assert.equal(pages['php/widget.html'].title, 'Heading Only')
  })

  it('uses only the file name when a note has no title or heading', () => {
    const { pages, navTree } = buildContent({
      'Documents/jobs.txt': 'plain text with no heading\n',
      'Documents/DIQSEO/ABELOHOST.txt': 'another untitled note\n',
    })
    assert.equal(pages['Documents/jobs.txt'].title, 'jobs.txt')
    assert.equal(pages['Documents/jobs.txt'].navLabel, 'jobs.txt')
    assert.equal(pages['Documents/DIQSEO/ABELOHOST.txt'].title, 'ABELOHOST.txt')

    const documents = navTree.find((node) => node.path === 'Documents')
    assert.equal(documents?.type, 'dir')
    const jobs = documents?.type === 'dir'
      ? documents.children.find((node) => node.type === 'page' && node.page.file === 'Documents/jobs.txt')
      : undefined
    assert.equal(jobs?.label, 'jobs.txt')
  })

  it('keeps a heading as the title when one exists', () => {
    const { pages } = buildContent({
      'Documents/jobs.txt': '# Job search\n\nNotes about openings.\n',
    })
    assert.equal(pages['Documents/jobs.txt'].title, 'Job search')
  })

  it('stores only a short preview in the card blurb', () => {
    const { pages } = buildContent({
      'Documents/long.txt': `${'line of notes without a blank break\n'.repeat(80)}`,
    })
    assert.ok(pages['Documents/long.txt'].blurb.length <= 160)
    assert.match(pages['Documents/long.txt'].raw, /line of notes without a blank break/)
  })

  it('strips markup from html card previews', () => {
    const html = `<div class="wpbc">${'<button>Book now</button>'.repeat(40)}</div>`
    const { pages } = buildContent({ 'demo/form.html': html })
    assert.equal(pages['demo/form.html'].blurb.includes('<'), false)
    assert.ok(pages['demo/form.html'].blurb.length <= 160)
  })

  it('does not parse yaml frontmatter in css or js', () => {
    const { pages } = buildContent({
      'php/theme.css': '---\ntitle: Stolen\n---\n\nbody { color: red; }',
      'php/main.js': '---\ntitle: Stolen\n---\n\nconsole.log(1)\n',
    })
    assert.equal(pages['php/theme.css'].title, 'Theme')
    assert.equal(pages['php/theme.css'].body, '---\ntitle: Stolen\n---\n\nbody { color: red; }')
    assert.equal(pages['php/main.js'].title, 'Main')
    assert.equal(pages['php/main.js'].body.startsWith('---'), true)
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

  it('still shows an attached root with no notes yet as an empty folder', () => {
    const { navTree, topicCount } = buildContent(
      { 'Notes/test.md': '---\ntitle: Test\n---\n' },
      { localRootLabels: ['Notes', 'skills'] },
    )
    const labels = navTree.map((node) => node.label).sort()
    assert.deepEqual(labels, ['Notes', 'Skills'])
    const empty = navTree.find((node) => node.label === 'Skills')
    assert.equal(empty?.type, 'dir')
    assert.equal((empty as { children: unknown[] }).children.length, 0)
    assert.equal(topicCount, 1)
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

  it('lists folders before files in a directory', () => {
    const { navTree } = buildContent({
      'Documents/1. set ownership.txt': 'plain note\n',
      'Documents/jobs.txt': 'jobs\n',
      'Documents/DIQSEO/host.txt': 'host\n',
    })
    const documents = navTree.find((node) => node.path === 'Documents')
    assert.equal(documents?.type, 'dir')
    if (documents?.type !== 'dir') return
    assert.deepEqual(
      documents.children.map((node) => node.type),
      ['dir', 'page', 'page'],
    )
    assert.equal(documents.children[0].path, 'Documents/DIQSEO')
  })
})

describe('hoistNavRoot', () => {
  it('splices the default vault children to the top of the tree', () => {
    const { navTree } = buildContent({
      'notes/index.md': '---\ntitle: Notes\nnav: Notes\n---\n',
      'notes/attention.md': '---\ntitle: Attention\n---\n',
      'notes/folder/index.md': '---\ntitle: Folder\n---\n',
      'work/sql.md': '---\ntitle: SQL\n---\n',
    })
    const hoisted = hoistNavRoot(navTree, 'notes')
    assert.deepEqual(
      hoisted.map((node) => node.label).sort(),
      ['Attention', 'Folder', 'Work'],
    )
    assert.equal(
      hoisted.some((node) => node.type === 'dir' && node.path === 'notes'),
      false,
    )
  })

  it('does not keep the vault index as a menu item', () => {
    const { navTree } = buildContent({
      'notes/index.md': '---\ntitle: Notes Vault\nnav: Notes Vault\n---\n',
      'notes/attention.md': '---\ntitle: Attention\n---\n',
    })
    const hoisted = hoistNavRoot(navTree, 'notes')
    assert.equal(
      hoisted.some((node) => node.label === 'Notes Vault' || node.path === 'notes'),
      false,
    )
    assert.equal(hoisted[0].label, 'Attention')
  })

  it('lists folders before files after the default vault is hoisted', () => {
    const { navTree } = buildContent({
      'notes/attention.md': '---\ntitle: Attention\n---\n',
      'notes/folder/index.md': '---\ntitle: Folder\n---\n',
      'work/sql.md': '---\ntitle: SQL\n---\n',
    })
    const hoisted = hoistNavRoot(navTree, 'notes')
    assert.deepEqual(
      hoisted.map((node) => node.type),
      ['dir', 'dir', 'page'],
    )
  })

  it('puts other folders above hoisted default-vault files, alphabetically', () => {
    const { navTree } = buildContent(
      {
        'Documents/discord.txt': 'chat\n',
        'Documents/Gabriel Rodrigues.txt': 'name\n',
        'notes/hello.md': '# Hi\n',
        'gabrielkrg-skills/README.md': '# Skills\n',
      },
      {
        githubFiles: ['gabrielkrg-skills/README.md'],
        githubNames: { 'gabrielkrg-skills': 'gabrielkrg/skills' },
        localRootLabels: ['Documents', 'notes'],
      },
    )
    const hoisted = hoistNavRoot(navTree, 'Documents')
    assert.deepEqual(
      hoisted.map((node) => node.type),
      ['dir', 'dir', 'page', 'page'],
    )
    assert.deepEqual(
      hoisted.filter((node) => node.type === 'dir').map((node) => node.label),
      ['gabrielkrg/skills', 'Notes'],
    )
    assert.deepEqual(
      hoisted.filter((node) => node.type === 'page').map((node) => node.label),
      ['discord.txt', 'Gabriel Rodrigues.txt'],
    )
  })

  it('leaves the tree unchanged when the label is empty', () => {
    const { navTree } = buildContent({
      'notes/attention.md': '---\ntitle: Attention\n---\n',
    })
    assert.equal(hoistNavRoot(navTree, ''), navTree)
  })
})

describe('routeFor', () => {
  it('strips markdown and text extensions', () => {
    assert.equal(routeFor('php/arrays.md'), 'php/arrays')
    assert.equal(routeFor('php/test.txt'), 'php/test')
    assert.equal(routeFor('php/index.md'), 'php')
    assert.equal(routeFor('php/index.txt'), 'php')
  })

  it('strips html, css, and js extensions', () => {
    assert.equal(routeFor('php/widget.html'), 'php/widget')
    assert.equal(routeFor('php/theme.css'), 'php/theme')
    assert.equal(routeFor('php/main.js'), 'php/main')
    assert.equal(routeFor('php/index.html'), 'php')
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

  it('does not parse markdown links inside html, css, js, or txt', () => {
    const { pages } = buildContent({
      'php/widget.html': '<p>See [Arrays](arrays.md)</p>',
      'php/notes.txt': 'See [Arrays](arrays.md)\n',
      'php/arrays.md': '# Arrays\n',
    })
    const graph = buildNoteGraph(pages)
    assert.equal(graph.edges.length, 0)
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
