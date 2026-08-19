import { useCallback, useRef, useState, type MouseEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import Annotator, { Annotated } from './Annotator.tsx'
import {
  loadAnnotations,
  rehypeAnnotate,
  saveAnnotations,
  type Annotation,
} from './annotations.ts'
import { resolveMdHref, type NotePage } from './content.ts'

export default function MarkdownView({ page, onNavigate }: { page: NotePage; onNavigate: (route: string) => void }) {
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
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, [rehypeAnnotate, live]]}
          components={{
            a({ href, children }) {
              const target = resolveMdHref(page.file, href || '')
              if (target.kind === 'internal') {
                return (
                  <a
                    href={`#/${target.route}${target.hash}`}
                    onClick={(event) => {
                      event.preventDefault()
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
