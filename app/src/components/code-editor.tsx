import { forwardRef, useImperativeHandle, useRef } from 'react'

import { highlightLanguage, highlightSource } from '@/lib/code-highlight.ts'
import type { NoteFileType } from '@/lib/note-name.ts'
import { cn } from '@/lib/utils'

export type CodeEditorHandle = {
  flush: () => string
}

type CodeEditorProps = {
  value: string
  kind: Exclude<NoteFileType, 'markdown'>
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

  useImperativeHandle(ref, () => ({
    flush() {
      return valueRef.current
    },
  }))

  const language = highlightLanguage(kind)
  const highlighted = highlightSource(value, kind)

  return (
    <div
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
