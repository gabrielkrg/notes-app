import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

import {
  collectPreviewAssetPaths,
  HTML_PREVIEW_FIND_MESSAGE,
  HTML_PREVIEW_SANDBOX,
  isHtmlPreviewFindResultMessage,
  isHtmlPreviewHeightMessage,
  isHtmlPreviewScrollMessage,
  isHtmlPreviewStorageMessage,
  readPreviewStorage,
  rewriteHtmlPreview,
  scrollOffsetForPreview,
  withPreviewBootstrap,
  withPreviewHeightReporter,
  writePreviewStorage,
} from '@/lib/html-preview.ts'
import type { FindResult } from '@/lib/find-in-page.ts'

function previewSrcDoc(
  file: string,
  html: string,
  files: Record<string, string>,
  loadAsset?: (asset: string) => string | null,
  storage?: Record<string, string>,
) {
  return withPreviewHeightReporter(
    withPreviewBootstrap(rewriteHtmlPreview(file, html, files, loadAsset), storage ?? readPreviewStorage(file)),
  )
}

function scrollParentOf(el: HTMLElement): HTMLElement {
  let node: HTMLElement | null = el.parentElement
  while (node && node !== document.body) {
    const overflowY = getComputedStyle(node).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return node
    node = node.parentElement
  }
  return document.scrollingElement instanceof HTMLElement
    ? document.scrollingElement
    : document.documentElement
}

export type HtmlPreviewHandle = {
  search: (query: string, index: number, options?: { reveal?: boolean; focus?: boolean }) => Promise<FindResult>
}

export const HtmlPreview = forwardRef<HtmlPreviewHandle, {
  file: string
  html: string
  files: Record<string, string>
  title: string
}>(function HtmlPreview({ file, html, files, title }, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const storageRef = useRef(readPreviewStorage(file))
  const [srcDoc, setSrcDoc] = useState(() => previewSrcDoc(file, html, files, undefined, storageRef.current))
  const [height, setHeight] = useState(0)

  useEffect(() => {
    storageRef.current = readPreviewStorage(file)
  }, [file])

  useEffect(() => {
    let cancelled = false
    const paths = collectPreviewAssetPaths(file, html, files)
    const readAsset = window.desktop?.readAsset
    setHeight(0)
    if (iframeRef.current) iframeRef.current.dataset.ready = ''
    if (!readAsset || !paths.length) {
      setSrcDoc(previewSrcDoc(file, html, files, undefined, storageRef.current))
      return
    }
    Promise.all(
      paths.map(async (asset) => {
        try {
          const result = await readAsset(asset)
          return [asset, result.dataUrl] as const
        } catch {
          return [asset, null] as const
        }
      }),
    ).then((entries) => {
      if (cancelled) return
      const map: Record<string, string> = {}
      for (const [asset, dataUrl] of entries) {
        if (dataUrl) map[asset] = dataUrl
      }
      setSrcDoc(previewSrcDoc(file, html, files, (asset) => map[asset] || null, storageRef.current))
    })
    return () => {
      cancelled = true
    }
  }, [file, html, files])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (isHtmlPreviewHeightMessage(event.data)) {
        setHeight(event.data.height)
        return
      }
      if (isHtmlPreviewStorageMessage(event.data)) {
        storageRef.current = event.data.data
        writePreviewStorage(file, event.data.data)
        return
      }
      if (isHtmlPreviewScrollMessage(event.data)) {
        const iframe = iframeRef.current
        if (!iframe) return
        const scroller = scrollParentOf(iframe)
        const iframeRect = iframe.getBoundingClientRect()
        const scrollerRect = scroller.getBoundingClientRect()
        scroller.scrollTo({
          top: Math.max(0, scrollOffsetForPreview(iframeRect.top, scrollerRect.top, scroller.scrollTop, event.data.y)),
          behavior: 'smooth',
        })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [file])

  useImperativeHandle(ref, () => ({
    search(query: string, index: number, options?: { reveal?: boolean; focus?: boolean }) {
      const reveal = options?.reveal !== false
      const focus = options?.focus === true
      return new Promise<FindResult>((resolve) => {
        const iframe = iframeRef.current
        const win = iframe?.contentWindow
        if (!iframe || !win) {
          resolve({ count: 0, index: -1 })
          return
        }
        const frame = iframe
        const send = () => {
          const timer = window.setTimeout(() => {
            window.removeEventListener('message', onMessage)
            resolve({ count: 0, index: -1 })
          }, 1500)
          function onMessage(event: MessageEvent) {
            if (event.source !== win) return
            if (!isHtmlPreviewFindResultMessage(event.data)) return
            window.clearTimeout(timer)
            window.removeEventListener('message', onMessage)
            if (reveal && event.data.count > 0) {
              const scroller = scrollParentOf(frame)
              const iframeRect = frame.getBoundingClientRect()
              const scrollerRect = scroller.getBoundingClientRect()
              scroller.scrollTo({
                top: Math.max(
                  0,
                  scrollOffsetForPreview(iframeRect.top, scrollerRect.top, scroller.scrollTop, event.data.y),
                ),
              })
            }
            resolve({ count: event.data.count, index: event.data.index })
          }
          window.addEventListener('message', onMessage)
          win.postMessage({ type: HTML_PREVIEW_FIND_MESSAGE, query, index, reveal, focus }, '*')
        }
        if (frame.dataset.ready === '1') send()
        else frame.addEventListener('load', send, { once: true })
      })
    },
  }))

      return (
    <iframe
      ref={iframeRef}
      title={title}
      sandbox={HTML_PREVIEW_SANDBOX}
      srcDoc={srcDoc}
      onLoad={() => {
        if (iframeRef.current) iframeRef.current.dataset.ready = '1'
      }}
      className="block w-full overflow-hidden border-0 bg-transparent"
      style={{ height: height ? `${height}px` : undefined }}
    />
  )
})
