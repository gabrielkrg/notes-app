import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react'

import { Button } from '@/components/ui/button'
import type { FindResult } from '@/lib/find-in-page.ts'
import { cn } from '@/lib/utils'

export function FindBar({
  query,
  result,
  focusToken = 0,
  inputRef,
  onQueryChange,
  onNext,
  onPrev,
  onClose,
}: {
  query: string
  result: FindResult
  focusToken?: number
  inputRef?: RefObject<HTMLInputElement | null>
  onQueryChange: (query: string) => void
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}) {
  const localRef = useRef<HTMLInputElement>(null)
  const setInput = useCallback(
    (el: HTMLInputElement | null) => {
      localRef.current = el
      if (inputRef) inputRef.current = el
    },
    [inputRef],
  )

  useLayoutEffect(() => {
    const el = localRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.select()
  }, [focusToken])

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) onPrev()
      else onNext()
      event.currentTarget.focus({ preventScroll: true })
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  const label = !query.trim() ? '' : result.count ? `${result.index + 1}/${result.count}` : 'No matches'

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background p-1.5 shadow-sm">
      <Search className="ml-1.5 size-4 shrink-0 text-muted-foreground" />
      <input
        ref={setInput}
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Find in note"
        aria-label="Find in note"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          'h-8 min-w-40 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none md:text-sm',
          'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'dark:bg-input/30',
        )}
      />
      <span className="min-w-16 px-1 text-right text-xs tabular-nums text-muted-foreground">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Previous match"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onPrev}
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Next match"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onNext}
      >
        <ChevronDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Close find"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  )
}
