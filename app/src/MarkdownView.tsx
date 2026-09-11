import { useCallback, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import Annotator, { Annotated } from './Annotator.tsx'
import {
  loadAnnotations,
  rehypeAnnotate,
  saveAnnotations,
  type Annotation,
} from './annotations.ts'
import { resolveMdHref, type NotePage } from './content.ts'
import { markdownRemarkPlugins } from './lib/md-render.ts'
import { rehypeTaskIndexes } from './lib/md-task.ts'

type TaskMarker = 'done' | 'partial' | 'todo'

function taskIndexFromNode(node: { properties?: Record<string, unknown> } | undefined): number | null {
  const index = Number(node?.properties?.dataTaskIndex)
  if (!Number.isInteger(index) || index < 0) return null
  return index
}

function taskMarker(checked: boolean | undefined, node: { properties?: Record<string, unknown> } | undefined): TaskMarker {
  if (node?.properties?.dataTaskState === 'partial') return 'partial'
  return checked ? 'done' : 'todo'
}

function TaskToggle({
  marker,
  index,
  onToggle,
}: {
  marker: TaskMarker
  index: number | null
  onToggle?: (index: number) => void
}) {
  const interactive = Boolean(onToggle) && index != null
  const checked = marker === 'done' ? true : marker === 'partial' ? 'mixed' : false
  const label = interactive
    ? marker === 'done'
      ? 'Mark as not started'
      : 'Mark as done'
    : marker === 'done'
      ? 'Done'
      : marker === 'partial'
        ? 'Seeded / partial'
        : 'Not started'

  return (
    <button
      type="button"
      className="task-toggle"
      data-state={marker}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={!interactive}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (interactive && index != null) onToggle?.(index)
      }}
    >
      {marker === 'done' ? <Check aria-hidden="true" /> : marker === 'partial' ? <span aria-hidden="true">~</span> : null}
    </button>
  )
}

export default function MarkdownView({
  page,
  onNavigate,
  onOpenSplit,
  onToggleTask,
}: {
  page: NotePage
  onNavigate: (route: string) => void
  onOpenSplit?: (route: string) => void
  onToggleTask?: (index: number) => void
}) {
  const rootRef = useRef(null)
  const [annotations, setAnnotations] = useState(() => loadAnnotations(page.file))

  const onChange = useCallback((next: Annotation[]) => {
    saveAnnotations(page.file, next)
    setAnnotations(next)
  }, [page.file])

  return (
    <Annotator rootRef={rootRef} annotations={annotations} onChange={onChange}>
      {({ onOpen, annotations: live }) => (
        <ReactMarkdown
          remarkPlugins={markdownRemarkPlugins}
          rehypePlugins={[rehypeHighlight, rehypeTaskIndexes, [rehypeAnnotate, live]]}
          components={{
            a({ href, children }) {
              const target = resolveMdHref(page.file, href || '')
              if (target.kind === 'internal') {
                return (
                  <a
                    href={`#/${target.route}${target.hash}`}
                    onClick={(event) => {
                      event.preventDefault()
                      // Ctrl/Cmd+click sends the note to the other pane instead
                      // of taking this one there.
                      if (onOpenSplit && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
                        onOpenSplit(target.route)
                        return
                      }
                      onNavigate(target.route)
                    }}
                  >
                    {children}
                  </a>
                )
              }
              if (target.kind === 'hash') {
                return <a href={target.href}>{children}</a>
              }
              return (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              )
            },
            h1() {
              return null
            },
            table({ children }) {
              return (
                <div className="typeset-scroll">
                  <table>{children}</table>
                </div>
              )
            },
            input({ node, type, checked }) {
              if (type !== 'checkbox') return <input type={type} checked={checked} readOnly />
              return (
                <TaskToggle
                  marker={taskMarker(checked, node)}
                  index={taskIndexFromNode(node)}
                  onToggle={onToggleTask}
                />
              )
            },
            span({ node, children, className, ...props }) {
              const id = node?.properties?.dataAnnId
              const cls = Array.isArray(className) ? className.filter(Boolean).join(' ') : className
              if (!id) {
                return <span className={cls} {...props}>{children}</span>
              }
              const annotation = live.find((item) => item.id === String(id))
              const isTip = node?.properties?.dataAnnTip !== undefined
              return (
                <Annotated
                  annotation={annotation}
                  isTip={isTip}
                  onOpen={onOpen}
                >
                  {children}
                </Annotated>
              )
            },
          }}
        >
          {page.body}
        </ReactMarkdown>
      )}
    </Annotator>
  )
}
