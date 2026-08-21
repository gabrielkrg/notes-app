import hljs from 'highlight.js/lib/core'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'

import type { CodeFileType } from './note-name.ts'

hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)

const LANG: Record<CodeFileType, string> = {
  html: 'xml',
  css: 'css',
  js: 'javascript',
}

export function highlightSource(value: string, kind: CodeFileType): string {
  const language = LANG[kind]
  try {
    return hljs.highlight(value, { language }).value
  } catch {
    return hljs.highlightAuto(value).value
  }
}

export function highlightLanguage(kind: CodeFileType): string {
  return LANG[kind]
}
