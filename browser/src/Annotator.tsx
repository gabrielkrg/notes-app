import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Highlighter, StickyNote, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  newAnnotation,
  quoteFromRange,
  removeAnnotation,
  upsertAnnotation,
  type Annotation,
  type AnnotationQuote,
} from './annotations.ts'

type MenuState = {
  quote: AnnotationQuote
  existing?: Annotation
  mode: 'choose' | 'note'
  x: number
  y: number
}

type AnnotatorChildren = (ctx: {
  onOpen: (annotation: Annotation, rect: DOMRect | { left: number; width: number; top: number }) => void
  annotations: Annotation[]
}) => ReactNode

export default function Annotator({
  rootRef,
  annotations,
  onChange,
  children,
}: {
  rootRef: RefObject<HTMLDivElement | null>
  annotations: Annotation[]
  onChange: (next: Annotation[]) => void
  children: AnnotatorChildren | ReactNode
}) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const host = rootRef.current
    if (!host) return
    const rootEl: HTMLDivElement = host

    function onPointerUp(event: Event) {
      const target = event.target
      if (target instanceof Element && target.closest?.('[data-slot="popover-content"], .ann-q')) return

      window.requestAnimationFrame(() => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          return
        }

        const range = selection.getRangeAt(0)
        if (!rootEl.contains(range.commonAncestorContainer)) {
          setMenu(null)
          return
        }

        const quote = quoteFromRange(range, rootEl)
        if (!quote) {
          setMenu(null)
          return
        }

        const rect = range.getBoundingClientRect()
        const existing = annotations.find(
          (item) =>
            item.exact === quote.exact &&
            item.prefix === quote.prefix &&
            item.suffix === quote.suffix,
        )

        setDraft(existing?.text || '')
        setMenu({
          quote,
          existing,
          mode: 'choose',
          x: clampX(rect.left + rect.width / 2),
          y: Math.max(8, rect.top),
        })
      })
    }

    document.addEventListener('mouseup', onPointerUp)
    document.addEventListener('touchend', onPointerUp)
    return () => {
      document.removeEventListener('mouseup', onPointerUp)
      document.removeEventListener('touchend', onPointerUp)
    }
  }, [annotations, rootRef])

  function highlight() {
    if (!menu) return
    onChange(
      upsertAnnotation(
        annotations,
        newAnnotation({
          ...(menu.existing || {}),
          ...menu.quote,
          type: menu.existing?.type === 'note' && menu.existing?.text ? 'note' : 'highlight',
          text: menu.existing?.text || '',
        }),
      ),
    )
    window.getSelection()?.removeAllRanges()
    setMenu(null)
  }

  function saveNote() {
    if (!menu) return
    const text = draft.trim()
    if (!text) return
    onChange(
      upsertAnnotation(
        annotations,
        newAnnotation({
          ...(menu.existing || {}),
          ...menu.quote,
          type: 'note',
          text,
        }),
      ),
    )
    window.getSelection()?.removeAllRanges()
    setMenu(null)
  }

  function remove(id: string) {
    onChange(removeAnnotation(annotations, id))
    setMenu(null)
    window.getSelection()?.removeAllRanges()
  }

  function openExisting(annotation: Annotation, rect: DOMRect | { left: number; width: number; top: number }) {
    setMenu({
      quote: {
        exact: annotation.exact,
        prefix: annotation.prefix,
        suffix: annotation.suffix,
      },
      existing: annotation,
      mode: annotation.type === 'note' ? 'note' : 'choose',
      x: clampX(rect.left + rect.width / 2),
      y: Math.max(8, rect.top),
    })
    setDraft(annotation.text || '')
  }

  return (
    <div className="relative" ref={rootRef}>
      {typeof children === 'function'
        ? children({ onOpen: openExisting, annotations })
        : children}

      <Popover open={!!menu} onOpenChange={(open) => { if (!open) setMenu(null) }}>
        {menu && (
          <PopoverAnchor asChild>
            <span
              className="pointer-events-none fixed z-40 size-0"
              style={{ left: menu.x, top: menu.y }}
            />
          </PopoverAnchor>
        )}
        <PopoverContent
          side="top"
          align="center"
          className="not-typeset w-64"
          onOpenAutoFocus={(event) => {
            if (menu?.mode !== 'note') event.preventDefault()
          }}
          onMouseDown={(event) => {
            if (!event.target || !(event.target instanceof Element) || !event.target.closest('textarea, input')) event.preventDefault()
          }}
        >
          {menu?.mode === 'choose' ? (
            <>
              <PopoverHeader>
                <PopoverDescription>“{truncate(menu.quote.exact, 48)}”</PopoverDescription>
              </PopoverHeader>
              <Button variant="ghost" className="justify-start" onClick={highlight}>
                <Highlighter />
                Highlight
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => setMenu({ ...menu, mode: 'note' })}
              >
                <StickyNote />
                Add a note
              </Button>
              {menu.existing && (
                <Button
                  variant="ghost"
                  className="justify-start text-destructive"
                  onClick={() => {
                    if (menu.existing) remove(menu.existing.id)
                  }}
                >
                  <Trash2 />
                  Remove
                </Button>
              )}
            </>
          ) : menu ? (
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                saveNote()
              }}
            >
              <PopoverHeader>
                <PopoverTitle>Note on “{truncate(menu.quote.exact, 36)}”</PopoverTitle>
              </PopoverHeader>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                autoFocus
                placeholder="What you want to remember about this…"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={!draft.trim()}>
                  Save note
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setMenu(menu.existing ? { ...menu, mode: 'choose' } : null)}
                >
                  Cancel
                </Button>
                {menu.existing && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                    if (menu.existing) remove(menu.existing.id)
                  }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </form>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function Annotated({
  annotation,
  children,
  isTip,
  onOpen,
}: {
  annotation?: Annotation
  children: ReactNode
  isTip?: boolean
  onOpen: (annotation: Annotation, rect: DOMRect | { left: number; width: number; top: number }) => void
}) {
  const ref = useRef<HTMLSpanElement>(null)

  function rect() {
    return ref.current?.getBoundingClientRect() || { left: 0, width: 0, top: 0 }
  }

  if (!annotation) return <span>{children}</span>

  const mark = (
    <span
      ref={ref}
      className={cn(
        'ann',
        annotation.type === 'note'
          ? 'ann-note cursor-help rounded-sm bg-amber-500/15 underline decoration-dotted decoration-amber-700 underline-offset-2 dark:decoration-amber-400'
          : 'ann-mark',
      )}
      data-ann-id={annotation.id}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onOpen(annotation, rect())
      }}
    >
      {children}
      {isTip && annotation.type === 'note' && (
        <button
          type="button"
          className="ann-q ml-0.5 inline-flex size-4 translate-y-[-0.1em] items-center justify-center rounded-full border border-amber-700 text-[10px] font-bold leading-none text-amber-800 dark:border-amber-400 dark:text-amber-300"
          aria-label="Show note"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpen(annotation, rect())
          }}
        >
          ?
        </button>
      )}
    </span>
  )

  if (annotation.type !== 'note' || !annotation.text) return mark

  return (
    <Tooltip>
      <TooltipTrigger asChild>{mark}</TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-pre-wrap">
        {annotation.text}
      </TooltipContent>
    </Tooltip>
  )
}

function clampX(x: number) {
  const pad = 140
  return Math.min(window.innerWidth - pad, Math.max(pad, x))
}

function truncate(value: string, max: number) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}
