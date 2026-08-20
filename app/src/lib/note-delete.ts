import fs from 'node:fs'
import path from 'node:path'

import { isNoteFile } from './note-name.ts'
import { resolveInside } from './note-path.ts'

export type DeleteNoteTarget = {
  kind: 'note'
  name: string
  file: string
}

export type DeleteFolderTarget = {
  kind: 'folder'
  name: string
  path: string
  expectedNames?: string[]
}

export type DeleteTarget = DeleteNoteTarget | DeleteFolderTarget

export type DeleteFolderOptions = {
  confirmName?: string
  expectedNames?: string[]
}

export function confirmFolderName(typed: string, allowedNames: string[] = []): boolean {
  const value = String(typed ?? '').trim()
  if (!value) return false
  return allowedNames.some((name) => String(name ?? '').trim() === value)
}

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
