import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  SquareCode,
  TextQuote,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { htmlToMd, joinNote, mdToHtml, splitFrontmatter } from '@/lib/md-wysiwyg.ts'

export type NoteEditorHandle = {
  flush: () => string
}

type NoteEditorProps = {
  value: string
  onChange?: (value: string) => void
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor({ value, onChange }, ref) {
  const [tab, setTab] = useState<'editor' | 'text'>('editor')
  const visualRef = useRef<HTMLDivElement>(null)
  const prefixRef = useRef('')
  const lastEmittedRef = useRef(value)
  const tabRef = useRef(tab)
  const syncedTabRef = useRef<'editor' | 'text' | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  tabRef.current = tab

  function emitMarkdown(next: string) {
    lastEmittedRef.current = next
    onChangeRef.current?.(next)
    return next
  }

  function emitFromVisual() {
    const html = visualRef.current?.innerHTML || ''
    return emitMarkdown(joinNote(prefixRef.current, htmlToMd(html)))
  }

  useLayoutEffect(() => {
    const tabChanged = syncedTabRef.current !== tab
    const external = value !== lastEmittedRef.current
    syncedTabRef.current = tab
    if (external) {
      lastEmittedRef.current = value
      prefixRef.current = splitFrontmatter(value).prefix
    }
    if (tab !== 'editor' || !visualRef.current) return
    if (!external && !tabChanged && visualRef.current.childNodes.length) return
    const { prefix, body } = splitFrontmatter(lastEmittedRef.current)
    prefixRef.current = prefix
    visualRef.current.innerHTML = mdToHtml(body) || '<p><br></p>'
  }, [value, tab])

  useImperativeHandle(ref, () => ({
    flush() {
      if (tabRef.current === 'editor' && visualRef.current) return emitFromVisual()
      return lastEmittedRef.current
    },
  }))

  function selectTab(next: 'editor' | 'text') {
    if (next === tab) return
    if (tab === 'editor') emitFromVisual()
    setTab(next)
  }

  function onTextChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value
    prefixRef.current = splitFrontmatter(next).prefix
    emitMarkdown(next)
  }

  function run(command: string, argument?: string) {
    visualRef.current?.focus()
    document.execCommand(command, false, argument)
    emitFromVisual()
  }

  function insertLink() {
    const url = window.prompt('Link URL')
    if (!url) return
    run('createLink', url)
  }

  function wrapInline(tagName: string) {
    visualRef.current?.focus()
    const ctx = selectionIn(visualRef.current)
    if (!ctx) return
    const el = document.createElement(tagName)
    try {
      if (ctx.range.collapsed) {
        el.appendChild(document.createTextNode('\u200b'))
        ctx.range.insertNode(el)
      } else {
        ctx.range.surroundContents(el)
      }
    } catch {
      el.appendChild(ctx.range.extractContents())
      ctx.range.insertNode(el)
    }
    ctx.sel.selectAllChildren(el)
    emitFromVisual()
  }

  function wrapCodeBlock() {
    visualRef.current?.focus()
    const ctx = selectionIn(visualRef.current)
    if (!ctx) return
    const lang = window.prompt('Language (optional)', '')
    if (lang == null) return
    const pre = document.createElement('pre')
    pre.setAttribute('data-md-code', lang.trim())
    const code = document.createElement('code')
    if (ctx.range.collapsed) {
      code.appendChild(document.createElement('br'))
    } else {
      code.appendChild(ctx.range.extractContents())
    }
    pre.appendChild(code)
    ctx.range.insertNode(pre)
    emitFromVisual()
  }

  function onVisualKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const key = event.key.toLowerCase()
    if (!(event.metaKey || event.ctrlKey)) return
    if (key === 'b') {
      event.preventDefault()
      run('bold')
    } else if (key === 'i') {
      event.preventDefault()
      run('italic')
    } else if (key === 'k') {
      event.preventDefault()
      insertLink()
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          <Button
            type="button"
            variant={tab === 'editor' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={tab === 'editor'}
            onClick={() => selectTab('editor')}
          >
            Editor
          </Button>
          <Button
            type="button"
            variant={tab === 'text' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={tab === 'text'}
            onClick={() => selectTab('text')}
          >
            Text
          </Button>
        </div>
      </div>

      {tab === 'editor' ? (
        <>
          <div className="flex flex-wrap items-center gap-0.5 rounded-lg border p-1">
            <ToolButton label="Bold" onClick={() => run('bold')}>
              <Bold />
            </ToolButton>
            <ToolButton label="Italic" onClick={() => run('italic')}>
              <Italic />
            </ToolButton>
            <ToolSep />
            <ToolButton label="Heading 1" onClick={() => run('formatBlock', '<h1>')}>
              <Heading1 />
            </ToolButton>
            <ToolButton label="Heading 2" onClick={() => run('formatBlock', '<h2>')}>
              <Heading2 />
            </ToolButton>
            <ToolButton label="Heading 3" onClick={() => run('formatBlock', '<h3>')}>
              <Heading3 />
            </ToolButton>
            <ToolSep />
            <ToolButton label="Bullet list" onClick={() => run('insertUnorderedList')}>
              <List />
            </ToolButton>
            <ToolButton label="Numbered list" onClick={() => run('insertOrderedList')}>
              <ListOrdered />
            </ToolButton>
            <ToolSep />
            <ToolButton label="Link" onClick={insertLink}>
              <Link />
            </ToolButton>
            <ToolButton label="Inline code" onClick={() => wrapInline('code')}>
              <Code />
            </ToolButton>
            <ToolButton label="Code block" onClick={wrapCodeBlock}>
              <SquareCode />
            </ToolButton>
            <ToolButton label="Quote" onClick={() => run('formatBlock', '<blockquote>')}>
              <TextQuote />
            </ToolButton>
            <ToolButton label="Horizontal rule" onClick={() => run('insertHorizontalRule')}>
              <Minus />
            </ToolButton>
          </div>
          <div
            ref={visualRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            role="textbox"
            aria-multiline="true"
            aria-label="Note editor"
            className="typeset typeset-docs min-h-128 max-w-none overflow-auto rounded-lg border border-input bg-transparent px-4 py-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>:first-child]:mt-0 [&_[data-md-raw]]:whitespace-pre-wrap dark:bg-input/30"
            onInput={emitFromVisual}
            onKeyDown={onVisualKeyDown}
          />
        </>
      ) : (
        <Textarea
          value={value}
          onChange={onTextChange}
          spellCheck={false}
          aria-label="Note source"
          className="min-h-128 resize-y font-mono text-[13px] leading-relaxed field-sizing-fixed"
        />
      )}
    </div>
  )
})

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function ToolSep() {
  return <Separator orientation="vertical" className="mx-1 h-5" />
}

function selectionIn(root: HTMLElement | null) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !root) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  return { sel, range }
}
