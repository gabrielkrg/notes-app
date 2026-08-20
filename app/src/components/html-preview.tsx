import { useEffect, useState } from 'react'

import {
  collectPreviewAssetPaths,
  HTML_PREVIEW_SANDBOX,
  isHtmlPreviewHeightMessage,
  rewriteHtmlPreview,
  withPreviewHeightReporter,
} from '@/lib/html-preview.ts'

function previewSrcDoc(
  file: string,
  html: string,
  files: Record<string, string>,
  loadAsset?: (asset: string) => string | null,
) {
  return withPreviewHeightReporter(rewriteHtmlPreview(file, html, files, loadAsset))
}

export function HtmlPreview({
  file,
  html,
  files,
  title,
}: {
  file: string
  html: string
  files: Record<string, string>
  title: string
}) {
  const [srcDoc, setSrcDoc] = useState(() => previewSrcDoc(file, html, files))
  const [height, setHeight] = useState(0)

  useEffect(() => {
    let cancelled = false
    const paths = collectPreviewAssetPaths(file, html, files)
    const readAsset = window.desktop?.readAsset
    setHeight(0)
    if (!readAsset || !paths.length) {
      setSrcDoc(previewSrcDoc(file, html, files))
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
      setSrcDoc(previewSrcDoc(file, html, files, (asset) => map[asset] || null))
    })
    return () => {
      cancelled = true
    }
  }, [file, html, files])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isHtmlPreviewHeightMessage(event.data)) return
      setHeight(event.data.height)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <iframe
      title={title}
      sandbox={HTML_PREVIEW_SANDBOX}
      srcDoc={srcDoc}
      className="block w-full overflow-hidden border-0 bg-transparent"
      style={{ height: height ? `${height}px` : undefined }}
    />
  )
}
