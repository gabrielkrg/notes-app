import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadGithubRemotes, loadGithubToken, saveGithubRemotes, saveGithubToken } from './github-store.ts'

describe('github-store', () => {
  it('round-trips remotes in storage', () => {
    const storage = memoryStorage()
    const saved = saveGithubRemotes(storage, [
      {
        id: 'github:acme/handbook@:',
        url: 'https://github.com/acme/handbook',
        owner: 'acme',
        repo: 'handbook',
      },
    ])
    assert.equal(saved[0].repo, 'handbook')
    assert.equal(loadGithubRemotes(storage)[0].owner, 'acme')
  })

  it('stores a token and can clear it', () => {
    const storage = memoryStorage()
    saveGithubToken(storage, '  ghp_secret  ')
    assert.equal(loadGithubToken(storage), 'ghp_secret')
    saveGithubToken(storage, '')
    assert.equal(loadGithubToken(storage), '')
  })
})

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
    removeItem(key: string) {
      map.delete(key)
    },
  }
}
