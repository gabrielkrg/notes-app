export function slugifyName(name: string): string {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[/\\]+/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!slug) throw new Error('Name must contain letters or numbers')
  return slug
}

export function isNoteFile(file: string): boolean {
  return /\.(md|txt)$/i.test(String(file))
}

export type NoteKind = 'note' | 'folder'

export type NoteFileFromNameOptions = {
  parent?: string
  kind?: NoteKind
}

export function noteFileFromName(name: string, { parent = '', kind = 'note' }: NoteFileFromNameOptions = {}): string {
  const slug = slugifyName(name)
  const dir = String(parent || '').replace(/^\/+|\/+$/g, '')
  if (kind === 'folder') {
    return dir ? `${dir}/${slug}/index.md` : `${slug}/index.md`
  }
  return dir ? `${dir}/${slug}.md` : `${slug}.md`
}

function yamlString(value: string): string {
  const text = String(value)
  if (text === '' || /[:#]|^\s|\s$/.test(text)) return JSON.stringify(text)
  return text
}

export function starterMarkdown({ title }: { title: string }): string {
  const heading = String(title || '').trim() || 'Untitled'
  return `---
title: ${yamlString(heading)}
nav: ${yamlString(heading)}
---

# ${heading}

`
}
