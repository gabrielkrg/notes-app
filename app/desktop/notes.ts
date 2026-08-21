import fs from 'node:fs'
import path from 'node:path'
import { app, dialog, safeStorage } from 'electron'

import { deleteFolderAt, deleteNoteAt } from '../src/lib/note-delete.ts'
import { renameFolderAt, renameNoteAt } from '../src/lib/note-rename.ts'
import { isNoteFile, nextUntitledName, noteFileFromName, parseNoteFileType, starterForType, type NoteKind } from '../src/lib/note-name.ts'
import { readAssetAt } from '../src/lib/note-asset.ts'
import { resolveInside } from '../src/lib/note-path.ts'
import {
  createParentPath,
  defaultNotesRootFromSettings,
  labelNotesRoots,
  mergeRootPages,
  persistableDefaultNotesRoot,
  resolveVirtualNote,
  rootsFromSettings,
  type AppSettings,
} from '../src/lib/notes-roots.ts'
import { acceptedNotesRoots, isTooBroadNotesRoot, loadNotesRoots } from '../src/lib/notes-walk.ts'
import { createFileGithubCache } from '../src/lib/github-file-cache.ts'
import {
  fetchGithubRootFiles,
  isGithubVirtualPath,
  normalizeGithubToken,
  remotesFromSettings,
  topLevelLabels,
  type GithubRemote,
} from '../src/lib/github-notes.ts'

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function readSettings(): AppSettings {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) as AppSettings
  } catch {
    return {}
  }
}

function writeSettings(next: AppSettings): void {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
  fs.writeFileSync(settingsFile(), `${JSON.stringify(next, null, 2)}\n`)
}

export function defaultNotesRoot(appDir: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'notes')
  }
  return path.join(appDir, 'notes')
}

function existingDirs(dirs: string[]): string[] {
  return dirs.filter((dir) => {
    try {
      return fs.existsSync(dir) && fs.statSync(dir).isDirectory()
    } catch {
      return false
    }
  })
}

function writeNotesRoots(next: string[], settings: AppSettings = readSettings()): string[] {
  const defaultNotesRoot = persistableDefaultNotesRoot(settings, next)
  const { notesRoot: _legacy, ...rest } = settings
  writeSettings({
    ...rest,
    notesRoots: next,
    defaultNotesRoot: defaultNotesRoot || undefined,
  })
  return next
}

export function notesRoots(appDir: string): string[] {
  const saved = existingDirs(rootsFromSettings(readSettings()).map((dir) => path.resolve(dir)))
  const usable = saved.filter((dir) => !isTooBroadNotesRoot(dir))
  if (usable.length !== saved.length) {
    writeNotesRoots(usable)
  }
  if (usable.length) return usable
  const fallback = defaultNotesRoot(appDir)
  return fs.existsSync(fallback) && fs.statSync(fallback).isDirectory() ? [fallback] : []
}

export function notesRoot(appDir: string): string {
  return notesRoots(appDir)[0]
}

export function getNotesRoots(appDir: string): string[] {
  return notesRoots(appDir)
}

export function getNotesRoot(appDir: string): string {
  return notesRoot(appDir)
}

export function setNotesRoots(dirs: string[]): string[] {
  return writeNotesRoots(acceptedNotesRoots(dirs))
}

export function getDefaultNotesRoot(appDir: string): string {
  return defaultNotesRootFromSettings(readSettings(), notesRoots(appDir))
}

export function setDefaultNotesRoot(appDir: string, dir: string): string {
  const roots = notesRoots(appDir)
  const resolved = path.resolve(String(dir || ''))
  if (!roots.some((root) => path.resolve(root) === resolved)) {
    throw new Error('Choose one of the attached notes folders')
  }
  writeSettings({ ...readSettings(), defaultNotesRoot: resolved })
  return resolved
}

export function setNotesRoot(dir: string): string {
  return setNotesRoots([dir])[0]
}

export async function pickNotesFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choose notes folder',
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
}

function labeled(appDir: string) {
  return labelNotesRoots(notesRoots(appDir))
}

function resolveInVault(appDir: string, virtualPath: string) {
  assertLocalNote(virtualPath)
  const { root, relative } = resolveVirtualNote(virtualPath, labeled(appDir))
  return { root, relative, abs: resolveInside(root, relative) }
}

let lastGithubLabels: string[] = []
let lastGithubErrors: { id: string; message: string }[] = []
let sessionGithubToken = ''
let githubTokenPersisted = true

function githubTokenFile(): string {
  return path.join(app.getPath('userData'), 'github-token.bin')
}

function githubCacheDir(): string {
  return path.join(app.getPath('userData'), 'github-cache')
}

function assertLocalNote(virtualPath: string): void {
  if (isGithubVirtualPath(virtualPath, lastGithubLabels)) {
    throw new Error('GitHub notes are read-only')
  }
}

export function getGithubRemotes(): GithubRemote[] {
  return remotesFromSettings(readSettings())
}

export function setGithubRemotes(remotes: GithubRemote[]): GithubRemote[] {
  const next = remotesFromSettings({ githubRemotes: remotes })
  writeSettings({ ...readSettings(), githubRemotes: next })
  return next
}

export function getGithubToken(): string {
  if (sessionGithubToken) return sessionGithubToken
  try {
    if (!safeStorage.isEncryptionAvailable()) return ''
    sessionGithubToken = safeStorage.decryptString(fs.readFileSync(githubTokenFile()))
    githubTokenPersisted = true
    return sessionGithubToken
  } catch {
    return ''
  }
}

export function setGithubToken(token: string): { persisted: boolean } {
  const next = normalizeGithubToken(token)
  sessionGithubToken = next
  if (!next) {
    try {
      fs.unlinkSync(githubTokenFile())
    } catch {
      /* already gone */
    }
    githubTokenPersisted = true
    return { persisted: true }
  }
  if (!safeStorage.isEncryptionAvailable()) {
    githubTokenPersisted = false
    return { persisted: false }
  }
  fs.mkdirSync(path.dirname(githubTokenFile()), { recursive: true })
  fs.writeFileSync(githubTokenFile(), safeStorage.encryptString(next))
  githubTokenPersisted = true
  return { persisted: true }
}

export function hasGithubToken(): boolean {
  return Boolean(getGithubToken())
}

export function isGithubTokenPersisted(): boolean {
  return githubTokenPersisted
}

export function clearGithubToken(): void {
  setGithubToken('')
}

export function getGithubSyncErrors(): { id: string; message: string }[] {
  return lastGithubErrors
}

export async function listNotes(
  appDir: string,
): Promise<{ files: Record<string, string>; githubFiles: string[]; githubNames: Record<string, string> }> {
  const local = mergeRootPages(loadNotesRoots(notesRoots(appDir)))
  const github = await fetchGithubRootFiles(getGithubRemotes(), {
    token: getGithubToken(),
    cache: createFileGithubCache(githubCacheDir()),
    usedLabels: topLevelLabels(local),
  })
  lastGithubLabels = github.labels
  lastGithubErrors = github.errors
  return {
    files: { ...github.files, ...local },
    githubFiles: Object.keys(github.files),
    githubNames: github.names,
  }
}

export function writeNote(appDir: string, file: string, content: string): { file: string } {
  const { abs, relative } = resolveInVault(appDir, file)
  if (!isNoteFile(relative)) {
    throw new Error('Only markdown, text, HTML, CSS, and JS files can be saved')
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, String(content ?? ''), 'utf8')
  return { file: String(file).replace(/\\/g, '/') }
}

export type CreateOpts = {
  parent?: string
  name?: string
  type?: string
}

function createAt(appDir: string, { parent, name, kind, type }: CreateOpts & { kind: NoteKind }): { file: string; raw: string } {
  const vaults = labeled(appDir)
  const parentPath = createParentPath(parent, notesRoots(appDir), getDefaultNotesRoot(appDir))
  assertLocalNote(parentPath || parent || '')
  if (vaults.length > 0 && !parentPath) {
    throw new Error('Choose a notes folder first')
  }
  const noteType = kind === 'folder' ? 'markdown' : parseNoteFileType(type)
  const title =
    String(name || '').trim() ||
    (kind === 'note'
      ? nextUntitledName((file) => fs.existsSync(resolveInVault(appDir, file).abs), {
          parent: parentPath,
          kind,
          type: noteType,
        })
      : '')
  const file = noteFileFromName(title, { parent: parentPath, kind, type: noteType })
  const { abs } = resolveInVault(appDir, file)
  if (fs.existsSync(abs)) {
    throw new Error('A note with that name already exists')
  }
  const raw = starterForType(noteType, title)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, raw, 'utf8')
  return { file, raw }
}

export function createNote(appDir: string, opts: CreateOpts = {}): { file: string; raw: string } {
  return createAt(appDir, { ...opts, kind: 'note' })
}

export function createFolder(appDir: string, opts: CreateOpts = {}): { file: string; raw: string } {
  return createAt(appDir, { ...opts, kind: 'folder' })
}

export function resolveNoteFile(appDir: string, file: string): string {
  return resolveInVault(appDir, file).abs
}

export function readAsset(appDir: string, file: string): { file: string; dataUrl: string } {
  const { root, relative } = resolveInVault(appDir, file)
  return readAssetAt(root, relative)
}

export function deleteNote(appDir: string, file: string): { file: string } {
  const { root, relative } = resolveInVault(appDir, file)
  return deleteNoteAt(root, relative)
}

export function deleteFolder(
  appDir: string,
  { path: dirPath = '', confirmName, expectedNames }: { path?: string; confirmName?: string; expectedNames?: string[] } = {},
): { path: string } {
  const { root, relative } = resolveInVault(appDir, dirPath)
  if (!relative) {
    throw new Error('Remove this folder in Settings instead')
  }
  return deleteFolderAt(root, relative, { confirmName, expectedNames })
}

function virtualPath(label: string, relative: string): string {
  return relative ? `${label}/${relative}` : label
}

export function renameNote(
  appDir: string,
  { file = '', name = '' }: { file?: string; name?: string } = {},
): { file: string } {
  assertLocalNote(file)
  const resolved = resolveVirtualNote(file, labeled(appDir))
  const result = renameNoteAt(resolved.root, resolved.relative, name)
  return { file: virtualPath(resolved.label, result.file) }
}

export function renameFolder(
  appDir: string,
  { path: dirPath = '', name = '' }: { path?: string; name?: string } = {},
): { path: string } {
  assertLocalNote(dirPath)
  const resolved = resolveVirtualNote(dirPath, labeled(appDir))
  if (!resolved.relative) {
    throw new Error('Rename this folder in Settings instead')
  }
  const result = renameFolderAt(resolved.root, resolved.relative, name)
  return { path: virtualPath(resolved.label, result.path) }
}
