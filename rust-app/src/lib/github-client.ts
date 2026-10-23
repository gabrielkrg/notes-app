import { createIndexedDbGithubCache } from './github-cache.ts'
import {
  fetchGithubRootFiles,
  githubRemoteFromParsed,
  parseGithubRepoUrl,
  type GithubRemote,
} from './github-notes.ts'
import { hasGithubToken, loadGithubRemotes, loadGithubToken, saveGithubRemotes, saveGithubToken } from './github-store.ts'

export type GithubSyncError = {
  id: string
  message: string
}

export type GithubLibraryState = {
  remotes: GithubRemote[]
  hasToken: boolean
  tokenPersisted: boolean
  errors: GithubSyncError[]
}

function browserStorage(): Storage {
  return window.localStorage
}

export async function loadGithubLibrary(): Promise<GithubLibraryState> {
  if (window.desktop?.getGithubRemotes) {
    const [remotes, hasToken, tokenPersisted, errors] = await Promise.all([
      window.desktop.getGithubRemotes(),
      window.desktop.hasGithubToken(),
      window.desktop.githubTokenPersisted ? window.desktop.githubTokenPersisted() : Promise.resolve(true),
      window.desktop.getGithubSyncErrors ? window.desktop.getGithubSyncErrors() : Promise.resolve([]),
    ])
    return { remotes, hasToken, tokenPersisted, errors }
  }

  return {
    remotes: loadGithubRemotes(browserStorage()),
    hasToken: hasGithubToken(browserStorage()),
    tokenPersisted: true,
    errors: [],
  }
}

export async function addGithubRemote(url: string): Promise<GithubRemote> {
  const remote = githubRemoteFromParsed(parseGithubRepoUrl(url), url.trim())
  const current = await listGithubRemotes()
  if (current.some((item) => item.id === remote.id)) return remote
  await persistGithubRemotes([...current, remote])
  return remote
}

export async function removeGithubRemote(id: string): Promise<GithubRemote[]> {
  const next = (await listGithubRemotes()).filter((item) => item.id !== id)
  return persistGithubRemotes(next)
}

export async function saveLibraryGithubToken(token: string): Promise<{ persisted: boolean }> {
  if (window.desktop?.setGithubToken) return window.desktop.setGithubToken(token)
  saveGithubToken(browserStorage(), token)
  return { persisted: true }
}

export async function clearLibraryGithubToken(): Promise<void> {
  if (window.desktop?.clearGithubToken) {
    await window.desktop.clearGithubToken()
    return
  }
  saveGithubToken(browserStorage(), '')
}

export async function fetchBrowserGithubNotes(usedLabels: string[] = []): Promise<{
  files: Record<string, string>
  githubFiles: string[]
  githubNames: Record<string, string>
  errors: GithubSyncError[]
}> {
  const remotes = loadGithubRemotes(browserStorage())
  if (!remotes.length) return { files: {}, githubFiles: [], githubNames: {}, errors: [] }
  const token = loadGithubToken(browserStorage())
  const github = await fetchGithubRootFiles(remotes, {
    token,
    cache: createIndexedDbGithubCache(),
    usedLabels,
  })
  return {
    files: github.files,
    githubFiles: Object.keys(github.files),
    githubNames: github.names,
    errors: github.errors,
  }
}

async function listGithubRemotes(): Promise<GithubRemote[]> {
  if (window.desktop?.getGithubRemotes) return window.desktop.getGithubRemotes()
  return loadGithubRemotes(browserStorage())
}

async function persistGithubRemotes(remotes: GithubRemote[]): Promise<GithubRemote[]> {
  if (window.desktop?.setGithubRemotes) return window.desktop.setGithubRemotes(remotes)
  return saveGithubRemotes(browserStorage(), remotes)
}
