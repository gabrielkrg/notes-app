import { forwardRef, useImperativeHandle, useRef } from 'react'

import { highlightLanguage, highlightSource } from '@/lib/code-highlight.ts'
import { revealInElement, revealInTextarea, type RevealOptions } from '@/lib/find-dom.ts'
import type { TextMatch } from '@/lib/find-in-page.ts'
import type { CodeFileType } from '@/lib/note-name.ts'
import { cn } from '@/lib/utils'

export type CodeEditorHandle = {
  flush: () => string
  findText: () => string
  revealMatch: (match: TextMatch, options?: RevealOptions) => void
}

type CodeEditorProps = {
  value: string
  kind: CodeFileType
  readOnly?: boolean
  onChange?: (value: string) => void
}

const surface = 'm-0 min-h-full w-full p-4 font-mono text-sm leading-6 [tab-size:2] whitespace-pre'

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, kind, readOnly = false, onChange },
  ref,
) {
  const valueRef = useRef(value)
  valueRef.current = value
  const wrapRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    flush() {
      return valueRef.current
    },
    findText() {
      return valueRef.current
    },
    revealMatch(match: TextMatch, options?: RevealOptions) {
      const pre = wrapRef.current?.querySelector('pre')
      if (pre instanceof HTMLElement) revealInElement(pre, match, { focus: false })
      if (areaRef.current) revealInTextarea(areaRef.current, match, wrapRef.current || undefined, options)
    },
  }))

  const language = highlightLanguage(kind)
  const highlighted = highlightSource(value, kind)

  return (
    <div
      ref={wrapRef}
      className={cn(
        'grid w-full overflow-auto rounded-lg border bg-muted/20 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
        readOnly ? 'max-h-[min(70vh,44rem)]' : 'min-h-128',
      )}
    >
      <pre aria-hidden className={cn(surface, 'col-start-1 row-start-1 pointer-events-none')}>
        <code
          className={`hljs language-${language}`}
          dangerouslySetInnerHTML={{ __html: `${highlighted || ' '}\n` }}
        />
      </pre>
      <textarea
        ref={areaRef}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        wrap="off"
        aria-label={readOnly ? 'Code' : 'Code editor'}
        onChange={(event) => onChange?.(event.target.value)}
        className={cn(
          surface,
          'col-start-1 row-start-1 z-10 resize-none overflow-hidden border-0 bg-transparent text-transparent caret-foreground shadow-none outline-none selection:bg-foreground/20 selection:text-transparent focus-visible:ring-0',
        )}
      />
    </div>
  )
})
