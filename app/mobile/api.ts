import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'

import type {
  AssetResult,
  CreateNoteInput,
  CreatedNote,
  DeleteFolderInput,
  DesktopApi,
  GithubRemoteInput,
  NotesSnapshot,
  RenameFolderInput,
  RenameNoteInput,
} from '../src/lib/desktop.ts'
import {
  fetchGithubRootFiles,
  isGithubVirtualPath,
  normalizeGithubToken,
  remotesFromSettings,
  topLevelLabels,
  type GithubRemote,
} from '../src/lib/github-notes.ts'
import { assetMimeFor, ASSET_MAX_BYTES, isAssetFile } from '../src/lib/note-asset-core.ts'
import { confirmFolderName } from '../src/lib/note-delete-core.ts'
import {
  fileKind,
  isNoteFile,
  nextUntitledName,
  noteFileFromName,
  parseNoteFileType,
  starterForType,
  type NoteKind,
} from '../src/lib/note-name.ts'
import { renamedFolderPath, renamedNoteFile, retitleMarkdown } from '../src/lib/note-rename-core.ts'
import {
  createParentPath,
  labelNotesRoots,
  mergeRootPages,
  resolveVirtualNote,
} from '../src/lib/notes-roots.ts'
import * as fs from './fs.ts'
import { NOTES_ROOT } from './fs.ts'
import { basename, joinPath, normalizeRelative, resolveInside } from './paths.ts'
import { installMobileShell } from './shell.ts'
import {
  createPreferencesGithubCache,
  readGithubToken,
  readSettings,
  writeGithubToken,
  writeSettings,
} from './settings.ts'

/**
 * Mobile has exactly one local notes folder, so the labeled-root table the
 * shared code expects is a constant. Virtual paths still look like
 * `notes/trip/index.md`, which keeps GitHub remotes on their own top-level
 * label exactly as they are on the desktop.
 */
const LABELED_ROOTS = labelNotesRoots([NOTES_ROOT])

let githubLabels: string[] = []
let githubErrors: { id: string; message: string }[] = []

function assertLocalNote(virtualPath: string): void {
  if (isGithubVirtualPath(virtualPath, githubLabels)) {
    throw new Error('GitHub notes are read-only')
  }
}

/** Maps a virtual path to a path under the app's notes directory. */
function resolveInVault(virtualPath: string): { relative: string; path: string } {
  assertLocalNote(virtualPath)
  const { relative } = resolveVirtualNote(virtualPath, LABELED_ROOTS)
  return { relative, path: resolveInside(NOTES_ROOT, relative) }
}

async function getGithubRemotes(): Promise<GithubRemote[]> {
  return remotesFromSettings(await readSettings())
}

/**
 * A fresh install has no notes folder at all. Seed it with a single starter
 * note so the first launch lands on something readable, the way the desktop
 * build ships a bundled `notes` folder.
 */
async function ensureNotesRoot(): Promise<void> {
  if (await fs.isDirectory(NOTES_ROOT)) return
  await fs.mkdirp(NOTES_ROOT)
  await fs.writeText(joinPath(NOTES_ROOT, 'index.md'), starterForType('markdown', 'Notes'))
}

async function listNotes(): Promise<NotesSnapshot> {
  await ensureNotesRoot()
  const local = mergeRootPages([{ root: NOTES_ROOT, files: await fs.walkNotes(NOTES_ROOT) }])
  const github = await fetchGithubRootFiles(await getGithubRemotes(), {
    token: await readGithubToken(),
    cache: createPreferencesGithubCache(),
    usedLabels: topLevelLabels(local),
  })
  githubLabels = github.labels
  githubErrors = github.errors
  return {
    files: { ...github.files, ...local },
    githubFiles: Object.keys(github.files),
    githubNames: github.names,
  }
}

async function writeNote(file: string, content: string): Promise<{ file: string }> {
  const { relative, path } = resolveInVault(file)
  if (!isNoteFile(relative)) {
    throw new Error('Only markdown, text, HTML, CSS, and JS files can be saved')
  }
  await fs.writeText(path, String(content ?? ''))
  return { file: normalizeRelative(file) }
}

async function createAt(
  { parent, name, type }: CreateNoteInput,
  kind: NoteKind,
): Promise<CreatedNote> {
  const parentPath = createParentPath(parent, [NOTES_ROOT], NOTES_ROOT)
  assertLocalNote(parentPath || parent || '')
  const noteType = kind === 'folder' ? 'markdown' : parseNoteFileType(type)

  const taken = await takenNamesIn(parentPath)
  const title =
    String(name || '').trim() ||
    (kind === 'note'
      ? nextUntitledName((file) => taken.has(file), { parent: parentPath, kind, type: noteType })
      : '')

  const file = noteFileFromName(title, { parent: parentPath, kind, type: noteType })
  const { path } = resolveInVault(file)
  if (await fs.exists(path)) {
    throw new Error('A note with that name already exists')
  }
  const raw = starterForType(noteType, title)
  await fs.writeText(path, raw)
  return { file, raw }
}

/** Virtual paths of the notes already sitting directly in `parentPath`. */
async function takenNamesIn(parentPath: string): Promise<Set<string>> {
  const { path } = resolveInVault(parentPath)
  const out = new Set<string>()
  try {
    const files = await fs.walkNotes(path)
    for (const relative of Object.keys(files)) {
      if (relative.includes('/')) continue
      out.add(joinPath(parentPath, relative))
    }
  } catch {
    // A parent folder that does not exist yet has nothing taken in it.
  }
  return out
}

async function readAsset(file: string): Promise<AssetResult> {
  const { relative, path } = resolveInVault(file)
  if (!isAssetFile(relative)) {
    throw new Error('Only image files can be loaded as assets')
  }
  if (!(await fs.isFile(path))) {
    throw new Error('Asset not found')
  }
  const base64 = await fs.readBase64(path)
  // base64 expands 3 bytes into 4 characters.
  if ((base64.length * 3) / 4 > ASSET_MAX_BYTES) {
    throw new Error('Asset is too large')
  }
  return { file: relative, dataUrl: `data:${assetMimeFor(relative)};base64,${base64}` }
}

async function deleteNote(file: string): Promise<{ file: string }> {
  const { relative, path } = resolveInVault(file)
  if (!isNoteFile(relative)) {
    throw new Error('Only markdown, text, HTML, CSS, and JS files can be deleted')
  }
  if (!(await fs.isFile(path))) {
    throw new Error('Note not found')
  }
  await fs.removeFile(path)
  return { file: relative }
}

async function deleteFolder({
  path: dirPath = '',
  confirmName,
  expectedNames,
}: DeleteFolderInput): Promise<{ path: string }> {
  const { relative, path } = resolveInVault(dirPath)
  if (!relative) {
    throw new Error('Cannot delete the notes folder')
  }
  const names = expectedNames?.length ? expectedNames : [basename(relative)]
  if (!confirmFolderName(confirmName ?? '', names)) {
    throw new Error('Type the folder name to confirm')
  }
  if (!(await fs.isDirectory(path))) {
    throw new Error('Folder not found')
  }
  await fs.removeDir(path)
  return { path: relative }
}

async function renameNote({ file = '', name = '' }: RenameNoteInput): Promise<{ file: string }> {
  const from = resolveInVault(file)
  const destRelative = renamedNoteFile(from.relative, name)
  const dest = resolveInside(NOTES_ROOT, destRelative)

  if (!(await fs.isFile(from.path))) {
    throw new Error('Note not found')
  }
  if (from.path !== dest && (await fs.exists(dest))) {
    throw new Error('A note with that name already exists')
  }

  let raw = await fs.readText(from.path)
  if (fileKind(destRelative) === 'markdown') {
    raw = retitleMarkdown(raw, String(name || '').trim())
  }
  if (from.path === dest) {
    await fs.writeText(from.path, raw)
  } else {
    await fs.writeText(dest, raw)
    await fs.removeFile(from.path)
  }
  return { file: virtualPath(destRelative) }
}

async function renameFolder({ path: dirPath = '', name = '' }: RenameFolderInput): Promise<{ path: string }> {
  const from = resolveInVault(dirPath)
  if (!from.relative) {
    throw new Error('Cannot rename the notes folder')
  }
  const destRelative = renamedFolderPath(from.relative, name)
  const dest = resolveInside(NOTES_ROOT, destRelative)

  if (!(await fs.isDirectory(from.path))) {
    throw new Error('Folder not found')
  }
  if (from.path !== dest && (await fs.exists(dest))) {
    throw new Error('A folder with that name already exists')
  }
  if (from.path !== dest) {
    await fs.move(from.path, dest)
  }

  const index = joinPath(dest, 'index.md')
  if (await fs.isFile(index)) {
    await fs.writeText(index, retitleMarkdown(await fs.readText(index), String(name || '').trim()))
  }
  return { path: virtualPath(destRelative) }
}

function virtualPath(relative: string): string {
  return joinPath(LABELED_ROOTS[0].label, relative)
}

async function setGithubRemotes(remotes: GithubRemoteInput[]): Promise<GithubRemoteInput[]> {
  const next = remotesFromSettings({ githubRemotes: remotes })
  await writeSettings({ ...(await readSettings()), githubRemotes: next })
  return next
}

/**
 * The subset of `DesktopApi` that means something on a phone. Window controls,
 * the folder picker and the multi-root setters are deliberately absent — every
 * caller in `src/` reaches them through optional chaining, so leaving them off
 * hides those affordances instead of showing dead buttons.
 */
export type MobileApi = Pick<
  DesktopApi,
  | 'platform'
  | 'isMaximized'
  | 'onMaximizeChange'
  | 'listNotes'
  | 'writeNote'
  | 'readAsset'
  | 'createNote'
  | 'createFolder'
  | 'deleteNote'
  | 'deleteFolder'
  | 'renameNote'
  | 'renameFolder'
  | 'getNotesRoot'
  | 'getNotesRoots'
  | 'getDefaultNotesRoot'
  | 'getGithubRemotes'
  | 'setGithubRemotes'
  | 'hasGithubToken'
  | 'githubTokenPersisted'
  | 'setGithubToken'
  | 'clearGithubToken'
  | 'getGithubSyncErrors'
  | 'openInBrowser'
>

export function createMobileApi(): MobileApi {
  return {
    platform: Capacitor.getPlatform(),

    // There is no window to maximize; the stubs exist because
    // `window-controls.tsx` calls them whenever `window.desktop` is present.
    isMaximized: async () => false,
    onMaximizeChange: () => () => {},

    listNotes,
    writeNote,
    readAsset,
    createNote: (opts: CreateNoteInput = {}) => createAt(opts, 'note'),
    createFolder: (opts: CreateNoteInput = {}) => createAt(opts, 'folder'),
    deleteNote,
    deleteFolder,
    renameNote,
    renameFolder,

    getNotesRoot: async () => NOTES_ROOT,
    getNotesRoots: async () => [NOTES_ROOT],
    getDefaultNotesRoot: async () => NOTES_ROOT,

    getGithubRemotes,
    setGithubRemotes,
    hasGithubToken: async () => Boolean(await readGithubToken()),
    githubTokenPersisted: async () => true,
    setGithubToken: async (token: string) => {
      await writeGithubToken(normalizeGithubToken(token))
      return { persisted: true }
    },
    clearGithubToken: async () => writeGithubToken(''),
    getGithubSyncErrors: async () => githubErrors,

    openInBrowser: async (file: string) => {
      // Only http(s) links can leave the app; local notes have no external viewer.
      if (/^https?:\/\//i.test(file)) await Browser.open({ url: file })
    },
  }
}

export function installMobileApi(): void {
  installMobileShell()
  window.desktop = createMobileApi() as DesktopApi
}
