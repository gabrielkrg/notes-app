import { forwardRef, useImperativeHandle, useRef } from 'react'

import { Textarea } from '@/components/ui/textarea'

import { collectText, revealInElement, revealInTextarea, type RevealOptions } from '@/lib/find-dom.ts'
import type { TextMatch } from '@/lib/find-in-page.ts'

export type PlainTextHandle = {
  flush: () => string
  findText: () => string
  revealMatch: (match: TextMatch, options?: RevealOptions) => void
}

type PlainTextProps = {
  value: string
  readOnly?: boolean
  onChange?: (value: string) => void
}

export const PlainText = forwardRef<PlainTextHandle, PlainTextProps>(function PlainText(
  { value, readOnly = false, onChange },
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
      if (wrapRef.current) return collectText(wrapRef.current)
      return valueRef.current
    },
    revealMatch(match: TextMatch, options?: RevealOptions) {
      if (areaRef.current) {
        revealInTextarea(areaRef.current, match, undefined, options)
        return
      }
      if (wrapRef.current) revealInElement(wrapRef.current, match, options)
    },
  }))

  if (readOnly) {
    return (
      <div ref={wrapRef} className="whitespace-pre-wrap break-words">
        {value}
      </div>
    )
  }

  return (
    <Textarea
      ref={areaRef}
      value={value}
      spellCheck={false}
      aria-label="Text editor"
      onChange={(event) => onChange?.(event.target.value)}
      className="min-h-128 w-full resize-y px-4 py-3 font-sans text-[18px] leading-[1.9] field-sizing-fixed"
    />
  )
})
