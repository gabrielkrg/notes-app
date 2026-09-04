import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'

import { isNoteFile } from '../src/lib/note-name.ts'
import { dirname, joinPath, normalizeRelative } from './paths.ts'

/**
 * App-private storage. Notes live in a single folder the app owns, so there is
 * no folder picker and no security-scoped bookmarks to keep alive.
 * Switch to `Directory.Documents` (plus UIFileSharingEnabled on iOS) if the
 * notes should ever show up in the system Files app.
 */
export const NOTES_DIRECTORY = Directory.Data

/** The one local root. Its basename is also its virtual-path label. */
export const NOTES_ROOT = 'notes'

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'vendor',
  '__pycache__',
  'venv',
])

const MAX_FILES = 5000
const MAX_DEPTH = 24

export async function exists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path, directory: NOTES_DIRECTORY })
    return true
  } catch {
    return false
  }
}

export async function isFile(path: string): Promise<boolean> {
  try {
    const stat = await Filesystem.stat({ path, directory: NOTES_DIRECTORY })
    return stat.type === 'file'
  } catch {
    return false
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stat = await Filesystem.stat({ path, directory: NOTES_DIRECTORY })
    return stat.type === 'directory'
  } catch {
    return false
  }
}

export async function mkdirp(path: string): Promise<void> {
  const rel = normalizeRelative(path)
  if (!rel || (await isDirectory(rel))) return
  try {
    await Filesystem.mkdir({ path: rel, directory: NOTES_DIRECTORY, recursive: true })
  } catch {
    // `mkdir` throws when the directory already exists; a concurrent create is fine.
    if (!(await isDirectory(rel))) throw new Error(`Could not create folder ${rel}`)
  }
}

export async function readText(path: string): Promise<string> {
  const result = await Filesystem.readFile({
    path,
    directory: NOTES_DIRECTORY,
    encoding: Encoding.UTF8,
  })
  return typeof result.data === 'string' ? result.data : await result.data.text()
}

export async function readBase64(path: string): Promise<string> {
  const result = await Filesystem.readFile({ path, directory: NOTES_DIRECTORY })
  if (typeof result.data === 'string') return result.data
  return blobToBase64(result.data)
}

export async function writeText(path: string, data: string): Promise<void> {
  await mkdirp(dirname(path))
  await Filesystem.writeFile({
    path,
    directory: NOTES_DIRECTORY,
    data,
    encoding: Encoding.UTF8,
    recursive: true,
  })
}

export async function removeFile(path: string): Promise<void> {
  await Filesystem.deleteFile({ path, directory: NOTES_DIRECTORY })
}

export async function removeDir(path: string): Promise<void> {
  await Filesystem.rmdir({ path, directory: NOTES_DIRECTORY, recursive: true })
}

export async function move(from: string, to: string): Promise<void> {
  await mkdirp(dirname(to))
  await Filesystem.rename({
    from,
    to,
    directory: NOTES_DIRECTORY,
    toDirectory: NOTES_DIRECTORY,
  })
}

/**
 * Recursively reads every note file under `root`, returning paths relative to
 * it. The async twin of `walkNotes` in `src/lib/notes-walk.ts`.
 */
export async function walkNotes(root: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  let files = 0

  async function walk(current: string, rel: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) return
    let entries: { name: string; type: string }[]
    try {
      const result = await Filesystem.readdir({ path: current, directory: NOTES_DIRECTORY })
      entries = result.files
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const childRel = rel ? `${rel}/${entry.name}` : entry.name
      const childPath = joinPath(current, entry.name)
      if (entry.type === 'directory') {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(childPath, childRel, depth + 1)
      } else if (isNoteFile(entry.name)) {
        files += 1
        if (files > MAX_FILES) return
        try {
          out[childRel] = await readText(childPath)
        } catch {
          // Unreadable file: skip it rather than failing the whole listing.
        }
      }
    }
  }

  await walk(root, '', 0)
  return out
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
    reader.readAsDataURL(blob)
  })
}
