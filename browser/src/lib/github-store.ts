import { storageKey } from './config.ts'
import { normalizeGithubToken, remotesFromSettings, type GithubRemote } from './github-notes.ts'

export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function remotesKey(): string {
  return storageKey('github.remotes')
}

function tokenKey(): string {
  return storageKey('github.token')
}

export function loadGithubRemotes(storage: StorageLike): GithubRemote[] {
  try {
    const parsed = JSON.parse(storage.getItem(remotesKey()) || '[]') as unknown
    return remotesFromSettings({ githubRemotes: Array.isArray(parsed) ? parsed : [] })
  } catch {
    return []
  }
}

export function saveGithubRemotes(storage: StorageLike, remotes: GithubRemote[]): GithubRemote[] {
  const next = remotesFromSettings({ githubRemotes: remotes })
  storage.setItem(remotesKey(), JSON.stringify(next))
  return next
}

export function loadGithubToken(storage: StorageLike): string {
  return String(storage.getItem(tokenKey()) || '').trim()
}

export function saveGithubToken(storage: StorageLike, token: string): void {
  const next = normalizeGithubToken(token)
  if (!next) storage.removeItem(tokenKey())
  else storage.setItem(tokenKey(), next)
}

export function hasGithubToken(storage: StorageLike): boolean {
  return Boolean(loadGithubToken(storage))
}
