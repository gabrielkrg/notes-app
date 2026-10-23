import { Bookmark, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import type { BookmarkEntry } from '@/lib/bookmarks.ts'

export function BookmarksDialog({
  open,
  onOpenChange,
  entries,
  onOpen,
  onRemove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: BookmarkEntry[]
  onOpen: (route: string) => void
  onRemove: (file: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(32rem,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="grid gap-1 border-b px-4 py-3 pr-12">
          <DialogTitle>Bookmarks</DialogTitle>
          <DialogDescription>
            Notes you have marked to come back to.
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {entries.length ? (
            <ul className="grid gap-1">
              {entries.map((entry) => (
                <li key={entry.file} className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
                    onClick={() => {
                      if (!entry.route) return
                      onOpen(entry.route)
                      onOpenChange(false)
                    }}
                    disabled={!entry.route}
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove bookmark ${entry.title}`}
                    onClick={() => onRemove(entry.file)}
                  >
                    <Bookmark className="fill-current" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-6 text-sm text-muted-foreground">
              No bookmarks yet. Open a note and bookmark it to see it here.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
