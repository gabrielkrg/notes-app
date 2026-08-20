import { isNoteFile } from './note-name.ts'
import type { AppSettings } from './notes-roots.ts'

export const SKIP_GITHUB_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'vendor',
  '__pycache__',
  'venv',
])

const DEFAULT_MAX_FILES = 5000
const DEFAULT_MAX_DEPTH = 24
const API_ROOT = 'https://api.github.com'

export class GithubNotesTooLargeError extends Error {
  constructor(
    message = 'That GitHub repository is too large to open as notes. Use a smaller folder of markdown files.',
  ) {
    super(message)
    this.name = 'GithubNotesTooLargeError'
  }
}

export type ParsedGithubRepo = {
  owner: string
  repo: string
  ref?: string
  subpath?: string
}

export type GithubRemote = {
  id: string
  url: string
  owner: string
  repo: string
  ref?: string
  subpath?: string
}

export type GithubTreeEntry = {
  path: string
  type: string
  sha: string
  size?: number
}

export type GithubNotesCacheEntry = {
  treeSha: string
  files: Record<string, string>
}

export type GithubNotesCache = {
  get(key: string): Promise<GithubNotesCacheEntry | null>
  set(key: string, value: GithubNotesCacheEntry): Promise<void>
}

export type FetchGithubNoteFilesOptions = {
  owner: string
  repo: string
  ref?: string
  subpath?: string
  token?: string
  fetch?: typeof fetch
  cache?: GithubNotesCache
  cacheKey?: string
  maxFiles?: number
  maxDepth?: number
  concurrency?: number
}

export function parseGithubRepoUrl(input: string): ParsedGithubRepo {
  const raw = String(input || '').trim()
  if (!raw) throw new Error('Paste a GitHub repository URL')

  const ssh = raw.match(/^git@github\.com:([^/]+)\/(.+)$/i)
  if (ssh) return fromOwnerRepo(ssh[1], ssh[2])

  if (!raw.includes('://') && !/^((www\.)?github\.com)\//i.test(raw)) {
    return parseGithubPath(raw)
  }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    throw new Error('Paste a GitHub repository URL')
  }

  if (!/^(www\.)?github\.com$/i.test(url.hostname)) {
    throw new Error('Use a github.com repository URL')
  }

  return parseGithubPath(url.pathname)
}

function fromOwnerRepo(owner: string, repoRaw: string): ParsedGithubRepo {
  return parseGithubPath(`${owner}/${repoRaw}`)
}

function parseGithubPath(pathname: string): ParsedGithubRepo {
  const parts = String(pathname || '')
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
  if (parts.length < 2) throw new Error('Paste a GitHub repository URL')

  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, '')
  if (!owner || !repo || owner === '.' || repo === '.') {
    throw new Error('Paste a GitHub repository URL')
  }

  if (parts.length === 2) return { owner, repo }

  const kind = parts[2]
  if (kind !== 'tree' && kind !== 'blob') {
    throw new Error('Paste a GitHub repository URL')
  }

  const rest = parts.slice(3)
  if (!rest.length) return { owner, repo }

  const parsed: ParsedGithubRepo = { owner, repo, ref: rest[0] }
  if (kind === 'tree') {
    const subpath = rest.slice(1).join('/')
    if (subpath) parsed.subpath = subpath
  }
  return parsed
}

export function githubRemoteId(parsed: ParsedGithubRepo): string {
  return `github:${parsed.owner}/${parsed.repo}@${parsed.ref || ''}:${parsed.subpath || ''}`
}

export function githubRootKey(remote: Pick<GithubRemote, 'owner' | 'repo' | 'subpath'>): string {
  const base = `github:${remote.owner}/${remote.repo}`
  return remote.subpath ? `${base}/${normalizeRelative(remote.subpath)}` : base
}

export function githubRemoteFromParsed(parsed: ParsedGithubRepo, url = ''): GithubRemote {
  const remote: GithubRemote = {
    id: githubRemoteId(parsed),
    url: url || `https://github.com/${parsed.owner}/${parsed.repo}`,
    owner: parsed.owner,
    repo: parsed.repo,
  }
  if (parsed.ref) remote.ref = parsed.ref
  if (parsed.subpath) remote.subpath = normalizeRelative(parsed.subpath)
  return remote
}

export function githubRemoteLabel(remote: Pick<GithubRemote, 'repo' | 'subpath'>): string {
  if (!remote.subpath) return remote.repo
  const leaf = normalizeRelative(remote.subpath).split('/').filter(Boolean).pop()
  return leaf && leaf !== remote.repo ? `${remote.repo}-${leaf}` : remote.repo
}

export function githubRemoteDisplayName(remote: Pick<GithubRemote, 'owner' | 'repo' | 'subpath'>): string {
  const base = `${remote.owner}/${remote.repo}`
  if (!remote.subpath) return base
  return `${base}/${normalizeRelative(remote.subpath)}`
}

export function remotesFromSettings(settings: AppSettings = {}): GithubRemote[] {
  if (!Array.isArray(settings.githubRemotes)) return []
  return settings.githubRemotes
    .map((item) => normalizeRemote(item))
    .filter((item): item is GithubRemote => Boolean(item))
}

function normalizeRemote(item: unknown): GithubRemote | null {
  if (!item || typeof item !== 'object') return null
  const remote = item as Partial<GithubRemote>
  const owner = String(remote.owner || '').trim()
  const repo = String(remote.repo || '').trim()
  if (!owner || !repo) return null
  const parsed: ParsedGithubRepo = { owner, repo }
  if (remote.ref) parsed.ref = String(remote.ref)
  if (remote.subpath) parsed.subpath = String(remote.subpath)
  const next = githubRemoteFromParsed(parsed, String(remote.url || ''))
  if (remote.id) next.id = String(remote.id)
  return next
}

export function selectGithubNoteEntries(
  entries: GithubTreeEntry[] = [],
  options: { subpath?: string; maxFiles?: number; maxDepth?: number } = {},
): GithubTreeEntry[] {
  const subpath = normalizeRelative(options.subpath || '')
  const prefix = subpath ? `${subpath}/` : ''
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const out: GithubTreeEntry[] = []

  for (const entry of entries) {
    if (entry.type !== 'blob') continue
    const original = normalizeRelative(entry.path)
    if (subpath && original !== subpath && !original.startsWith(prefix)) continue
    const relative = subpath ? (original === subpath ? '' : original.slice(prefix.length)) : original
    if (!relative || skippedRelative(relative) || !isNoteFile(relative)) continue
    if (relative.split('/').length > maxDepth) continue
    out.push({ ...entry, path: relative })
    if (out.length > maxFiles) throw new GithubNotesTooLargeError()
  }

  return out
}

function skippedRelative(relative: string): boolean {
  return relative.split('/').some((part) => part.startsWith('.') || SKIP_GITHUB_DIRS.has(part))
}

function normalizeRelative(value: string): string {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

export function redactSecrets(message: string, token = ''): string {
  let out = String(message || '')
  const secret = String(token || '')
  if (secret && out.includes(secret)) out = out.split(secret).join('***')
  return out
}

export function normalizeGithubToken(raw: string): string {
  let token = String(raw || '').trim()
  token = token.replace(/^(bearer|token)\s+/i, '').trim()
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim()
  }
  return token.replace(/\s+/g, '')
}

export function githubApiError(
  status: number,
  body: unknown = {},
  extra: { token?: string } = {},
): Error {
  const token = normalizeGithubToken(extra.token || '')
  let message = 'Could not load that GitHub repository'
  if (status === 401) {
    message = 'GitHub rejected that token. Create a fine-grained token with Contents: Read.'
  } else if (status === 404) {
    message = token
      ? 'That token cannot read this repository. Grant it access to the repo with Contents: Read, then Sync.'
      : 'Repository not found. If it is private, add a token with access to it.'
  } else if (status === 403) {
    const text = errorMessageFromBody(body)
    if (/rate limit/i.test(text)) {
      message = 'GitHub rate limit reached. Add a token or wait and try again.'
    } else if (/SSO|SAML/i.test(text)) {
      message = 'GitHub needs SSO authorization for this token.'
    } else {
      message = 'GitHub denied access to that repository.'
    }
  }
  return new Error(redactSecrets(message, token || extra.token))
}

function errorMessageFromBody(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    return String((body as { message: unknown }).message || '')
  }
  return ''
}

export async function fetchGithubNoteFiles(
  options: FetchGithubNoteFilesOptions,
): Promise<Record<string, string>> {
  const request = options.fetch ?? globalThis.fetch
  const token = normalizeGithubToken(options.token || '')
  const { owner, repo } = options

  async function api<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'notes-desk',
    }
    if (token) headers.Authorization = `Bearer ${token}`
    let res: Response
    try {
      res = await request(`${API_ROOT}${path}`, { headers })
    } catch (err) {
      throw new Error(redactSecrets(err instanceof Error ? err.message : 'Could not reach GitHub', token))
    }
    if (!res.ok) {
      let body: unknown = {}
      try {
        body = await res.json()
      } catch {
        body = {}
      }
      throw githubApiError(res.status, body, { token })
    }
    return res.json() as Promise<T>
  }

  let ref = options.ref
  if (!ref) {
    const repoInfo = await api<{ default_branch?: string }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`)
    ref = repoInfo.default_branch || 'main'
  }

  const commit = await api<{ commit?: { tree?: { sha?: string } } }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}`,
  )
  const treeSha = commit.commit?.tree?.sha || ''
  if (!treeSha) throw new Error('Could not read that GitHub branch')

  const cacheKey = options.cacheKey || githubRemoteId({ owner, repo, ref: options.ref, subpath: options.subpath })
  if (options.cache) {
    const hit = await options.cache.get(cacheKey)
    if (hit && hit.treeSha === treeSha) return hit.files
  }

  const tree = await api<{ truncated?: boolean; tree?: GithubTreeEntry[] }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`,
  )
  if (tree.truncated) throw new GithubNotesTooLargeError()

  const selected = selectGithubNoteEntries(tree.tree || [], {
    subpath: options.subpath,
    maxFiles: options.maxFiles,
    maxDepth: options.maxDepth,
  })

  const files: Record<string, string> = {}
  const concurrency = Math.max(1, options.concurrency ?? 8)
  let next = 0

  async function worker() {
    while (next < selected.length) {
      const index = next
      next += 1
      const entry = selected[index]
      const blob = await api<{ content?: string; encoding?: string }>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(entry.sha)}`,
      )
      files[entry.path] = decodeGitBlob(blob.content || '', blob.encoding)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) || 0 }, () => worker()))

  if (options.cache) await options.cache.set(cacheKey, { treeSha, files })
  return files
}

export function decodeGitBlob(content: string, encoding = 'base64'): string {
  if (encoding && encoding !== 'base64') return String(content)
  const clean = String(content || '').replace(/\s/g, '')
  if (!clean) return ''
  if (typeof Buffer !== 'undefined') return Buffer.from(clean, 'base64').toString('utf8')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function topLevelLabels(files: Record<string, string> = {}, extra: string[] = []): string[] {
  const labels = new Set(extra.map((item) => String(item || '').trim()).filter(Boolean))
  for (const file of Object.keys(files)) {
    const label = normalizeRelative(file).split('/')[0]
    if (label) labels.add(label)
  }
  return [...labels]
}

function allocateGithubLabel(item: { label: string; owner?: string }, used: Set<string>): string {
  const base = String(item.label || '').trim() || 'github'
  const owner = String(item.owner || '').trim()
  const candidates = owner && owner !== base ? [base, `${owner}-${base}`] : [base]
  for (const candidate of candidates) {
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
  }
  const fallback = candidates[candidates.length - 1]
  let n = 2
  let label = `${fallback}-${n}`
  while (used.has(label)) {
    n += 1
    label = `${fallback}-${n}`
  }
  used.add(label)
  return label
}

export function mergeGithubRoots(
  items: { label: string; owner?: string; displayName?: string; files?: Record<string, string> }[] = [],
  usedLabels: string[] = [],
): { files: Record<string, string>; names: Record<string, string> } {
  const used = new Set(usedLabels.map((item) => String(item || '').trim()).filter(Boolean))
  const files: Record<string, string> = {}
  const names: Record<string, string> = {}
  for (const item of items) {
    const label = allocateGithubLabel(item, used)
    const owner = String(item.owner || '').trim()
    names[label] = String(item.displayName || '').trim() || (owner ? `${owner}/${item.label}` : item.label)
    for (const [key, content] of Object.entries(item.files || {})) {
      const relative = normalizeRelative(key)
      if (!relative || skippedRelative(relative)) continue
      files[`${label}/${relative}`] = content
    }
  }
  return { files, names }
}

export function mergeGithubRootPages(
  items: { label: string; owner?: string; displayName?: string; files?: Record<string, string> }[] = [],
  usedLabels: string[] = [],
): Record<string, string> {
  return mergeGithubRoots(items, usedLabels).files
}

export function githubLabelsFromPages(pages: Record<string, string> = {}): string[] {
  const labels = new Set<string>()
  for (const file of Object.keys(pages)) {
    const label = normalizeRelative(file).split('/')[0]
    if (label) labels.add(label)
  }
  return [...labels]
}

export function isGithubVirtualPath(path: string, labels: string[] = []): boolean {
  const relative = normalizeRelative(path)
  if (!relative) return false
  return labels.some((label) => relative === label || relative.startsWith(`${label}/`))
}

export type FetchGithubRootFilesOptions = Omit<
  FetchGithubNoteFilesOptions,
  'owner' | 'repo' | 'ref' | 'subpath' | 'cacheKey'
> & {
  usedLabels?: string[]
}

export async function fetchGithubRootFiles(
  remotes: GithubRemote[] = [],
  options: FetchGithubRootFilesOptions = {},
): Promise<{ files: Record<string, string>; labels: string[]; names: Record<string, string>; errors: { id: string; message: string }[] }> {
  const { usedLabels = [], ...fetchOptions } = options
  const loaded: { label: string; owner?: string; displayName: string; files: Record<string, string> }[] = []
  const errors: { id: string; message: string }[] = []
  for (const remote of remotes) {
    try {
      const files = await fetchGithubNoteFiles({
        ...fetchOptions,
        owner: remote.owner,
        repo: remote.repo,
        ref: remote.ref,
        subpath: remote.subpath,
        cacheKey: remote.id,
      })
      loaded.push({
        label: githubRemoteLabel(remote),
        owner: remote.owner,
        displayName: githubRemoteDisplayName(remote),
        files,
      })
    } catch (err) {
      errors.push({
        id: remote.id,
        message: redactSecrets(
          err instanceof Error ? err.message : 'Could not load that GitHub repository',
          fetchOptions.token,
        ),
      })
    }
  }
  const { files, names } = mergeGithubRoots(loaded, usedLabels)
  return { files, labels: githubLabelsFromPages(files), names, errors }
}
