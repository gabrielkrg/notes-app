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
  return /\.(md|txt|html|css|js)$/i.test(String(file))
}

export type NoteKind = 'note' | 'folder'
export type NoteFileType = 'markdown' | 'text' | 'html' | 'css' | 'js'
export type CodeFileType = Exclude<NoteFileType, 'markdown' | 'text'>

export type NoteFileFromNameOptions = {
  parent?: string
  kind?: NoteKind
  type?: NoteFileType
}

export function fileKind(file: string): NoteFileType {
  const name = String(file || '')
  if (/\.txt$/i.test(name)) return 'text'
  if (/\.html$/i.test(name)) return 'html'
  if (/\.css$/i.test(name)) return 'css'
  if (/\.js$/i.test(name)) return 'js'
  return 'markdown'
}

export function parseNoteFileType(value: unknown): NoteFileType {
  if (value == null || value === '') return 'markdown'
  if (value === 'markdown' || value === 'text' || value === 'html' || value === 'css' || value === 'js') return value
  throw new Error('Unknown note type')
}

function extensionForType(type: NoteFileType): string {
  if (type === 'text') return 'txt'
  if (type === 'html') return 'html'
  if (type === 'css') return 'css'
  if (type === 'js') return 'js'
  return 'md'
}

export function noteFileFromName(name: string, { parent = '', kind = 'note', type = 'markdown' }: NoteFileFromNameOptions = {}): string {
  const slug = slugifyName(name)
  const dir = String(parent || '').replace(/^\/+|\/+$/g, '')
  if (kind === 'folder') {
    return dir ? `${dir}/${slug}/index.md` : `${slug}/index.md`
  }
  const ext = extensionForType(type)
  return dir ? `${dir}/${slug}.${ext}` : `${slug}.${ext}`
}

export function nextUntitledName(
  isTaken: (file: string) => boolean,
  options: NoteFileFromNameOptions = {},
): string {
  for (let n = 1; n < 10_000; n++) {
    const name = n === 1 ? 'Untitled' : `Untitled ${n}`
    if (!isTaken(noteFileFromName(name, options))) return name
  }
  throw new Error('Could not find an unused Untitled name')
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

export function starterHtml({ title }: { title: string }): string {
  const heading = String(title || '').trim() || 'Untitled'
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${heading}</title>
  </head>
  <body>
    <h1>${heading}</h1>
  </body>
</html>
`
}

export function starterCss({ title }: { title: string }): string {
  const heading = String(title || '').trim() || 'Untitled'
  return `/* ${heading} */
`
}

export function starterJs({ title }: { title: string }): string {
  const heading = String(title || '').trim() || 'Untitled'
  return `// ${heading}
`
}

export function starterText({ title }: { title: string }): string {
  const heading = String(title || '').trim() || 'Untitled'
  return `${heading}\n\n`
}

export function starterForType(type: NoteFileType, title: string): string {
  if (type === 'html') return starterHtml({ title })
  if (type === 'css') return starterCss({ title })
  if (type === 'js') return starterJs({ title })
  if (type === 'text') return starterText({ title })
  return starterMarkdown({ title })
}
