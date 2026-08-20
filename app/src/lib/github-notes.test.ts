import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  GithubNotesTooLargeError,
  fetchGithubNoteFiles,
  githubApiError,
  githubLabelsFromPages,
  githubRemoteDisplayName,
  githubRemoteFromParsed,
  githubRootKey,
  isGithubVirtualPath,
  mergeGithubRoots,
  mergeGithubRootPages,
  normalizeGithubToken,
  parseGithubRepoUrl,
  remotesFromSettings,
  selectGithubNoteEntries,
} from './github-notes.ts'

describe('parseGithubRepoUrl', () => {
  it('parses https://github.com/owner/repo', () => {
    assert.deepEqual(parseGithubRepoUrl('https://github.com/acme/handbook'), {
      owner: 'acme',
      repo: 'handbook',
    })
  })

  it('parses owner/repo and strips .git', () => {
    assert.deepEqual(parseGithubRepoUrl('acme/handbook.git'), {
      owner: 'acme',
      repo: 'handbook',
    })
  })

  it('parses a tree URL with branch and subpath', () => {
    assert.deepEqual(parseGithubRepoUrl('https://github.com/acme/handbook/tree/main/docs'), {
      owner: 'acme',
      repo: 'handbook',
      ref: 'main',
      subpath: 'docs',
    })
  })

  it('parses git@github.com:owner/repo.git', () => {
    assert.deepEqual(parseGithubRepoUrl('git@github.com:acme/handbook.git'), {
      owner: 'acme',
      repo: 'handbook',
    })
  })

  it('rejects a non-GitHub URL', () => {
    assert.throws(() => parseGithubRepoUrl('https://gitlab.com/acme/handbook'), /github/i)
  })
})

describe('selectGithubNoteEntries', () => {
  const tree = [
    { path: 'README.md', type: 'blob', sha: 'a' },
    { path: 'src/app.ts', type: 'blob', sha: 'b' },
    { path: 'node_modules/pkg/README.md', type: 'blob', sha: 'c' },
    { path: '.github/ISSUE_TEMPLATE.md', type: 'blob', sha: 'd' },
    { path: 'docs/intro.md', type: 'blob', sha: 'e' },
    { path: 'docs/notes.txt', type: 'blob', sha: 'f' },
    { path: 'docs', type: 'tree', sha: 'g' },
  ]

  it('keeps only markdown and text blobs', () => {
    const selected = selectGithubNoteEntries(tree)
    assert.deepEqual(
      selected.map((item) => item.path),
      ['README.md', 'docs/intro.md', 'docs/notes.txt'],
    )
  })

  it('strips a subpath prefix from selected files', () => {
    const selected = selectGithubNoteEntries(tree, { subpath: 'docs' })
    assert.deepEqual(
      selected.map((item) => item.path),
      ['intro.md', 'notes.txt'],
    )
  })

  it('throws when there are more note files than the limit', () => {
    assert.throws(
      () => selectGithubNoteEntries(tree, { maxFiles: 1 }),
      GithubNotesTooLargeError,
    )
  })
})

describe('normalizeGithubToken', () => {
  it('strips Bearer prefixes, quotes, and wrapping whitespace', () => {
    assert.equal(normalizeGithubToken('  Bearer github_pat_abc  '), 'github_pat_abc')
    assert.equal(normalizeGithubToken('"ghp_abc"'), 'ghp_abc')
    assert.equal(normalizeGithubToken('ghp_ab\nc'), 'ghp_abc')
  })
})

describe('githubApiError', () => {
  it('asks for a token when a private repo 404s without one', () => {
    const err = githubApiError(404, {})
    assert.match(err.message, /not found|private/i)
    assert.match(err.message, /token/i)
  })

  it('explains a 404 when a token was sent but cannot read the repo', () => {
    const err = githubApiError(404, {}, { token: 'ghp_secret_token_value' })
    assert.match(err.message, /cannot read|Contents: Read|repository access/i)
    assert.doesNotMatch(err.message, /ghp_secret_token_value/)
  })

  it('explains a bad token', () => {
    assert.match(githubApiError(401, {}).message, /token/i)
  })

  it('explains a rate limit', () => {
    assert.match(
      githubApiError(403, { message: 'API rate limit exceeded for user' }).message,
      /rate limit/i,
    )
  })
})

describe('fetchGithubNoteFiles', () => {
  it('fetches note blobs for the default branch', async () => {
    const files = await fetchGithubNoteFiles({
      owner: 'acme',
      repo: 'handbook',
      fetch: mockGithubFetch({
        defaultBranch: 'main',
        treeSha: 'tree1',
        tree: [
          { path: 'README.md', type: 'blob', sha: 'blob1' },
          { path: 'src/app.ts', type: 'blob', sha: 'blob2' },
        ],
        blobs: { blob1: '# Hello\n' },
      }),
    })
    assert.deepEqual(files, { 'README.md': '# Hello\n' })
  })

  it('skips blob fetches when the tree SHA is already cached', async () => {
    let blobCalls = 0
    const fetch = mockGithubFetch({
      defaultBranch: 'main',
      treeSha: 'tree-cached',
      tree: [{ path: 'README.md', type: 'blob', sha: 'blob1' }],
      blobs: { blob1: '# Fresh\n' },
      onBlob: () => {
        blobCalls += 1
      },
    })
    const cache = memoryGithubCache()
    await cache.set('github:acme/handbook@:', {
      treeSha: 'tree-cached',
      files: { 'README.md': '# Cached\n' },
    })

    const files = await fetchGithubNoteFiles({
      owner: 'acme',
      repo: 'handbook',
      fetch,
      cache,
      cacheKey: 'github:acme/handbook@:',
    })
    assert.deepEqual(files, { 'README.md': '# Cached\n' })
    assert.equal(blobCalls, 0)
  })

  it('sends a normalized Bearer token on GitHub API requests', async () => {
    let authorization = ''
    await fetchGithubNoteFiles({
      owner: 'acme',
      repo: 'handbook',
      token: 'Bearer ghp_secret\n',
      fetch: mockGithubFetch({
        defaultBranch: 'main',
        treeSha: 'tree1',
        tree: [{ path: 'README.md', type: 'blob', sha: 'blob1' }],
        blobs: { blob1: '# Hello\n' },
        onRequest(_input, init) {
          const headers = new Headers(init?.headers)
          authorization = headers.get('authorization') || ''
        },
      }),
    })
    assert.equal(authorization, 'Bearer ghp_secret')
  })

  it('does not put the token in thrown errors', async () => {
    await assert.rejects(
      () =>
        fetchGithubNoteFiles({
          owner: 'acme',
          repo: 'private',
          token: 'ghp_secret_token_value',
          fetch: async () =>
            new Response('{}', {
              status: 404,
              headers: { 'content-type': 'application/json' },
            }),
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.doesNotMatch(err.message, /ghp_secret_token_value/)
        return true
      },
    )
  })
})

describe('mergeGithubRootPages', () => {
  it('always prefixes files with the repo label', () => {
    const pages = mergeGithubRootPages([
      {
        label: 'handbook',
        files: { 'README.md': '# Hi' },
      },
    ])
    assert.equal(pages['handbook/README.md'], '# Hi')
    assert.equal(pages['README.md'], undefined)
  })

  it('suffixes colliding labels', () => {
    const pages = mergeGithubRootPages([
      { label: 'notes', files: { 'a.md': 'A' } },
      { label: 'notes', files: { 'b.md': 'B' } },
    ])
    assert.equal(pages['notes/a.md'], 'A')
    assert.equal(pages['notes-2/b.md'], 'B')
  })

  it('uses owner-repo when the repo name is already a local folder', () => {
    const pages = mergeGithubRootPages(
      [{ label: 'skills', owner: 'gabrielkrg', files: { 'README.md': '# Git' } }],
      ['skills', 'notes'],
    )
    assert.equal(pages['gabrielkrg-skills/README.md'], '# Git')
    assert.equal(pages['skills/README.md'], undefined)
  })

  it('does not treat the local folder as github after remapping', () => {
    const pages = mergeGithubRootPages(
      [{ label: 'skills', owner: 'gabrielkrg', files: { 'README.md': '# Git' } }],
      ['skills'],
    )
    const labels = githubLabelsFromPages(pages)
    assert.equal(isGithubVirtualPath('skills', labels), false)
    assert.equal(isGithubVirtualPath('gabrielkrg-skills/README.md', labels), true)
  })

  it('keeps an owner/repo display name when the path is remapped', () => {
    const { files, names } = mergeGithubRoots(
      [
        {
          label: 'skills',
          owner: 'gabrielkrg',
          displayName: 'gabrielkrg/skills',
          files: { 'README.md': '# Git' },
        },
      ],
      ['skills'],
    )
    assert.equal(files['gabrielkrg-skills/README.md'], '# Git')
    assert.equal(names['gabrielkrg-skills'], 'gabrielkrg/skills')
  })
})

describe('isGithubVirtualPath', () => {
  it('matches a github-prefixed file or folder', () => {
    assert.equal(isGithubVirtualPath('handbook/README.md', ['handbook']), true)
    assert.equal(isGithubVirtualPath('handbook', ['handbook']), true)
    assert.equal(isGithubVirtualPath('php/arrays.md', ['handbook']), false)
  })
})

describe('githubRemoteFromParsed', () => {
  it('builds a remote with a stable root key', () => {
    const remote = githubRemoteFromParsed(parseGithubRepoUrl('https://github.com/acme/handbook/tree/main/docs'))
    assert.equal(remote.owner, 'acme')
    assert.equal(remote.repo, 'handbook')
    assert.equal(remote.ref, 'main')
    assert.equal(remote.subpath, 'docs')
    assert.equal(githubRootKey(remote), 'github:acme/handbook/docs')
    assert.equal(githubRemoteDisplayName(remote), 'acme/handbook/docs')
  })

  it('uses owner/repo as the GitHub label', () => {
    const remote = githubRemoteFromParsed(parseGithubRepoUrl('https://github.com/gabrielkrg/skills'))
    assert.equal(githubRemoteDisplayName(remote), 'gabrielkrg/skills')
  })
})

describe('remotesFromSettings', () => {
  it('reads githubRemotes from settings', () => {
    const remotes = remotesFromSettings({
      githubRemotes: [
        {
          id: 'github:acme/handbook@:',
          url: 'https://github.com/acme/handbook',
          owner: 'acme',
          repo: 'handbook',
        },
      ],
    })
    assert.equal(remotes.length, 1)
    assert.equal(remotes[0].repo, 'handbook')
  })

  it('returns an empty list when unset', () => {
    assert.deepEqual(remotesFromSettings({}), [])
  })
})

function memoryGithubCache() {
  const store = new Map<string, { treeSha: string; files: Record<string, string> }>()
  return {
    async get(key: string) {
      return store.get(key) ?? null
    },
    async set(key: string, value: { treeSha: string; files: Record<string, string> }) {
      store.set(key, value)
    },
  }
}

function mockGithubFetch({
  defaultBranch,
  treeSha,
  tree,
  blobs,
  onBlob,
  onRequest,
}: {
  defaultBranch: string
  treeSha: string
  tree: { path: string; type: string; sha: string }[]
  blobs: Record<string, string>
  onBlob?: () => void
  onRequest?: (input: RequestInfo | URL, init?: RequestInit) => void
}): typeof fetch {
  return async (input, init) => {
    onRequest?.(input, init)
    const url = String(input)
    if (url === 'https://api.github.com/repos/acme/handbook') {
      return jsonResponse({ default_branch: defaultBranch })
    }
    if (url === `https://api.github.com/repos/acme/handbook/commits/${defaultBranch}`) {
      return jsonResponse({ sha: 'commit1', commit: { tree: { sha: treeSha } } })
    }
    if (url === `https://api.github.com/repos/acme/handbook/git/trees/${treeSha}?recursive=1`) {
      return jsonResponse({ sha: treeSha, truncated: false, tree })
    }
    const blob = url.match(/\/git\/blobs\/([^/?]+)$/)
    if (blob) {
      onBlob?.()
      const text = blobs[blob[1]]
      if (text == null) return new Response('{}', { status: 404 })
      return jsonResponse({
        encoding: 'base64',
        content: Buffer.from(text, 'utf8').toString('base64'),
      })
    }
    return new Response('{}', { status: 404 })
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
