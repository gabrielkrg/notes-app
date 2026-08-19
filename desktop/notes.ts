import fs from 'node:fs'
import path from 'node:path'
import { app, dialog } from 'electron'

import { deleteFolderAt, deleteNoteAt } from '../browser/src/lib/note-delete.ts'
import { isNoteFile, noteFileFromName, starterMarkdown, type NoteKind } from '../browser/src/lib/note-name.ts'
import { resolveInside } from '../browser/src/lib/note-path.ts'
import {
  labelNotesRoots,
  mergeRootPages,
  resolveVirtualNote,
  rootsFromSettings,
  type AppSettings,
} from '../browser/src/lib/notes-roots.ts'
import { acceptedNotesRoots, isTooBroadNotesRoot, loadNotesRoots } from '../browser/src/lib/notes-walk.ts'

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

export function notesRoots(appDir: string): string[] {
  const saved = existingDirs(rootsFromSettings(readSettings()).map((dir) => path.resolve(dir)))
  const usable = saved.filter((dir) => !isTooBroadNotesRoot(dir))
  if (usable.length !== saved.length) {
    const { notesRoot: _legacy, ...rest } = readSettings()
    writeSettings({ ...rest, notesRoots: usable })
  }
  if (usable.length) return usable
  return [defaultNotesRoot(appDir)]
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
  const next = acceptedNotesRoots(dirs)
  const { notesRoot: _legacy, ...rest } = readSettings()
  writeSettings({ ...rest, notesRoots: next })
  return next
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
  const { root, relative } = resolveVirtualNote(virtualPath, labeled(appDir))
  return { root, relative, abs: resolveInside(root, relative) }
}

export function listNotes(appDir: string): Record<string, string> {
  return mergeRootPages(loadNotesRoots(notesRoots(appDir)))
}

export function writeNote(appDir: string, file: string, content: string): { file: string } {
  const { abs, relative } = resolveInVault(appDir, file)
  if (!isNoteFile(relative)) {
    throw new Error('Only markdown and text files can be saved')
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, String(content ?? ''), 'utf8')
  return { file: String(file).replace(/\\/g, '/') }
}

export type CreateOpts = {
  parent?: string
  name?: string
}

function createAt(appDir: string, { parent, name, kind }: CreateOpts & { kind: NoteKind }): { file: string; raw: string } {
  const vaults = labeled(appDir)
  if (vaults.length > 1 && !String(parent || '').trim()) {
    throw new Error('Choose a notes folder first')
  }
  const file = noteFileFromName(name || '', { parent, kind })
  const { abs } = resolveInVault(appDir, file)
  if (fs.existsSync(abs)) {
    throw new Error('A note with that name already exists')
  }
  const title = String(name || '').trim()
  const raw = starterMarkdown({ title })
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
