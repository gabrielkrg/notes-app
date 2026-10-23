import { joinNote, splitFrontmatter } from './md-wysiwyg.ts'
import { fileKind, isNoteFile, noteFileFromName, slugifyName } from './note-name.ts'

export type RenameNoteTarget = {
  kind: 'note'
  name: string
  file: string
}

export type RenameFolderTarget = {
  kind: 'folder'
  name: string
  path: string
}

export type RenameTarget = RenameNoteTarget | RenameFolderTarget

function yamlString(value: string): string {
  const text = String(value)
  if (text === '' || /[:#]|^\s|\s$/.test(text)) return JSON.stringify(text)
  return text
}

function upsertYamlKey(prefix: string, key: string, value: string): string {
  const line = `${key}: ${yamlString(value)}`
  const re = new RegExp(`^${key}:.*$`, 'm')
  if (re.test(prefix)) return prefix.replace(re, line)
  return prefix.replace(/(\r?\n)---(\r?\n)*$/, `\n${line}$1---$2`)
}

function replaceFirstHeading(body: string, title: string): string {
  return body.replace(/^#\s+.+$/m, `# ${title}`)
}

export function retitleMarkdown(raw: string, title: string): string {
  const heading = String(title || '').trim() || 'Untitled'
  const { prefix, body } = splitFrontmatter(raw)
  const nextBody = replaceFirstHeading(body, heading)
  if (!prefix) return nextBody
  return joinNote(upsertYamlKey(upsertYamlKey(prefix, 'title', heading), 'nav', heading), nextBody)
}

export function renamedNoteFile(file: string, name: string): string {
  const rel = String(file || '').replace(/\\/g, '/')
  if (!isNoteFile(rel)) {
    throw new Error('Only markdown, text, HTML, CSS, and JS files can be renamed')
  }
  const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : ''
  return noteFileFromName(name, { parent: dir, kind: 'note', type: fileKind(rel) })
}

export function renamedFolderPath(dirPath: string, name: string): string {
  const rel = String(dirPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!rel) throw new Error('Cannot rename the notes folder')
  const parent = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : ''
  const slug = slugifyName(name)
  return parent ? `${parent}/${slug}` : slug
}
