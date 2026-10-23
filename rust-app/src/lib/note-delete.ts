import fs from 'node:fs'
import path from 'node:path'

import { isNoteFile } from './note-name.ts'
import { confirmFolderName, type DeleteFolderOptions } from './note-delete-core.ts'
import { resolveInside } from './note-path.ts'

export { confirmFolderName }
export type {
  DeleteFolderOptions,
  DeleteFolderTarget,
  DeleteNoteTarget,
  DeleteTarget,
} from './note-delete-core.ts'

export function deleteNoteAt(root: string, file: string): { file: string } {
  const rel = String(file || '').replace(/\\/g, '/')
  if (!isNoteFile(rel)) {
    throw new Error('Only markdown, text, HTML, CSS, and JS files can be deleted')
  }
  const abs = resolveInside(root, rel)
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new Error('Note not found')
  }
  fs.unlinkSync(abs)
  return { file: rel }
}

export function deleteFolderAt(root: string, dirPath: string, { confirmName, expectedNames }: DeleteFolderOptions = {}): { path: string } {
  const names = expectedNames?.length
    ? expectedNames
    : [path.basename(String(dirPath || ''))]
  if (!confirmFolderName(confirmName ?? '', names)) {
    throw new Error('Type the folder name to confirm')
  }

  const rel = String(dirPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const abs = resolveInside(root, rel)
  const base = path.resolve(root)
  if (abs === base) {
    throw new Error('Cannot delete the notes folder')
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error('Folder not found')
  }
  fs.rmSync(abs, { recursive: true, force: true })
  return { path: rel }
}
