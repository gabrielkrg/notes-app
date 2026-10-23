import { ArrowLeftRight, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CodeEditor } from '@/components/code-editor'
import { HtmlPreview } from '@/components/html-preview'
import { PlainText } from '@/components/plain-text'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { fileKind } from '@/lib/note-name.ts'
import MarkdownView from '../MarkdownView.tsx'
import type { NotePage } from '../content.ts'

/**
 * The second, read-only pane. Editing stays a main-pane affair — the swap
 * button moves this note over there when you want to change it.
 */
export function SplitPane({
  page,
  route,
  files,
  onGo,
  onOpenSplit,
  onSwap,
  onClose,
}: {
  page: NotePage | null
  route: string
  files: Record<string, string>
  onGo: (route: string) => void
  onOpenSplit: (route: string) => void
  onSwap: () => void
  onClose: () => void
}) {
  const kind = page ? fileKind(page.file) : 'markdown'

  return (
    <aside
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      aria-label="Split view"
    >
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {page ? page.navLabel || page.title : route}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Swap panes"
              onClick={onSwap}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftRight />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Swap with the main pane</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close split view"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close split view</TooltipContent>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {!page ? (
          <div className="px-4 py-6">
            <p className="text-sm text-muted-foreground">That note is no longer here.</p>
          </div>
        ) : (
          <div className="flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
            {kind === 'html' ? (
              <HtmlPreview file={page.file} html={page.raw} files={files} title={page.title} />
            ) : kind === 'css' || kind === 'js' ? (
              <CodeEditor key={page.file} kind={kind} value={page.raw} readOnly />
            ) : (
              <div className="typeset typeset-docs w-full">
                {kind === 'text' ? (
                  <PlainText key={page.file} value={page.body} readOnly />
                ) : (
                  <MarkdownView
                    key={page.file}
                    page={page}
                    onNavigate={onOpenSplit}
                    onOpenSplit={onGo}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
