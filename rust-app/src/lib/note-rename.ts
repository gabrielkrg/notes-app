import fs from 'node:fs'
import path from 'node:path'

import { fileKind } from './note-name.ts'
import { renamedFolderPath, renamedNoteFile, retitleMarkdown } from './note-rename-core.ts'
import { resolveInside } from './note-path.ts'

export { renamedFolderPath, renamedNoteFile, retitleMarkdown }
export type { RenameFolderTarget, RenameNoteTarget, RenameTarget } from './note-rename-core.ts'

export function renameNoteAt(root: string, file: string, name: string): { file: string } {
  const from = String(file || '').replace(/\\/g, '/')
  const dest = renamedNoteFile(from, name)
  const fromAbs = resolveInside(root, from)
  const destAbs = resolveInside(root, dest)
  if (!fs.existsSync(fromAbs) || !fs.statSync(fromAbs).isFile()) {
    throw new Error('Note not found')
  }
  if (path.resolve(fromAbs) !== path.resolve(destAbs) && fs.existsSync(destAbs)) {
    throw new Error('A note with that name already exists')
  }

  let raw = fs.readFileSync(fromAbs, 'utf8')
  if (fileKind(from) === 'markdown') {
    raw = retitleMarkdown(raw, String(name || '').trim())
  }
  if (path.resolve(fromAbs) === path.resolve(destAbs)) {
    fs.writeFileSync(fromAbs, raw, 'utf8')
    return { file: dest }
  }
  fs.mkdirSync(path.dirname(destAbs), { recursive: true })
  fs.writeFileSync(destAbs, raw, 'utf8')
  fs.unlinkSync(fromAbs)
  return { file: dest }
}

export function renameFolderAt(root: string, dirPath: string, name: string): { path: string } {
  const from = String(dirPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const dest = renamedFolderPath(from, name)
  const fromAbs = resolveInside(root, from)
  const destAbs = resolveInside(root, dest)
  const base = path.resolve(root)
  if (fromAbs === base) {
    throw new Error('Cannot rename the notes folder')
  }
  if (!fs.existsSync(fromAbs) || !fs.statSync(fromAbs).isDirectory()) {
    throw new Error('Folder not found')
  }
  if (path.resolve(fromAbs) !== path.resolve(destAbs) && fs.existsSync(destAbs)) {
    throw new Error('A folder with that name already exists')
  }

  if (path.resolve(fromAbs) !== path.resolve(destAbs)) {
    fs.renameSync(fromAbs, destAbs)
  }

  const index = path.join(destAbs, 'index.md')
  if (fs.existsSync(index) && fs.statSync(index).isFile()) {
    const raw = fs.readFileSync(index, 'utf8')
    fs.writeFileSync(index, retitleMarkdown(raw, String(name || '').trim()), 'utf8')
  }
  return { path: dest }
}
