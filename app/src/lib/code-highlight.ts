import hljs from 'highlight.js/lib/core'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'

import type { NoteFileType } from './note-name.ts'

hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)

const LANG: Record<Exclude<NoteFileType, 'markdown'>, string> = {
  html: 'xml',
  css: 'css',
  js: 'javascript',
}

export function highlightSource(value: string, kind: Exclude<NoteFileType, 'markdown'>): string {
  const language = LANG[kind]
  try {
    return hljs.highlight(value, { language }).value
  } catch {
    return hljs.highlightAuto(value).value
  }
}

export function highlightLanguage(kind: Exclude<NoteFileType, 'markdown'>): string {
  return LANG[kind]
}
