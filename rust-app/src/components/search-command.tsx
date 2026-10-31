import { cn } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, CornerDownLeft, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { flattenPages, sectionForRoute, type NavNode } from '@/content.ts'
import {
  CONTENT_SEARCH_DEBOUNCE_MS,
  matchesNoteMeta,
  searchNoteContents,
  shouldSearchContent,
  type ContentHit,
} from '@/lib/search-notes.ts'

function useIsMac() {
  const [mac, setMac] = useState(() =>
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent),
  )
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.userAgent))
  }, [])
  return mac
}

export function ShortcutHint({ className, keyLabel = 'K' }: { className?: string; keyLabel?: string }) {
  const mac = useIsMac()
  return (
    <KbdGroup className={className}>
      <Kbd>{mac ? '⌘' : 'Ctrl'}</Kbd>
      <Kbd>{keyLabel}</Kbd>
    </KbdGroup>
  )
}

export function SearchTrigger({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Search notes"
      aria-keyshortcuts="Control+K"
      onClick={onOpen}
      className={cn("workspace-search", className)}
    >
      <Search />
      <span>Search notes…</span>
      <ShortcutHint />
    </Button>
  )
}

export function SearchCommand({
  open,
  onOpenChange,
  onGo,
  tree = [],
  listenShortcut = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGo: (route: string) => void
  tree?: NavNode[]
  listenShortcut?: boolean
}) {
  const pages = useMemo(() => flattenPages(tree), [tree])
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ContentHit[]>([])
  const nativeSearch = window.desktop?.searchNotes
  const [nativeFiles, setNativeFiles] = useState<{ file: string; route: string; title: string; navLabel?: string }[]>([])
  const [searchError, setSearchError] = useState('')

  const fileMatches = useMemo(
    () => nativeSearch ? nativeFiles : pages.filter((page) => matchesNoteMeta(page, query)).slice(0, 30),
    [pages, query, nativeFiles, nativeSearch],
  )
  const showDashboard = matchesNoteMeta(
    { file: '', route: '', title: 'Dashboard', body: '' },
    query,
  )

  useEffect(() => {
    if (!listenShortcut) return
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listenShortcut, open, onOpenChange])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setHits([])
      setNativeFiles([])
      return
    }
    if (nativeSearch) {
      let active = true
      setHits([])
      setNativeFiles([])
      setSearchError('')
      // Invoke immediately; Rust searches cached indexes away from the UI thread.
      void nativeSearch(query).then((result) => {
        if (!active) return
        setNativeFiles(result.files)
        setHits(result.contents)
      }).catch((error: unknown) => {
        if (active) setSearchError(error instanceof Error ? error.message : 'Search failed')
      })
      return () => { active = false }
    }
    if (!shouldSearchContent(query)) {
      setHits([])
      return
    }
    setHits([])
    const nextQuery = query.trim()
    const timer = window.setTimeout(() => {
      setHits(searchNoteContents(pages, nextQuery))
    }, CONTENT_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [open, pages, query, nativeSearch])

  function go(route: string) {
    onGo(route)
    onOpenChange(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search notes"
      description="Jump to a file or a match inside a note"
    >
      <Command shouldFilter={false}>
        <CommandInput placeholder="Search notes…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{searchError || 'No matches found.'}</CommandEmpty>
          {(showDashboard || fileMatches.length > 0) && (
            <CommandGroup heading="Files">
              {showDashboard && (
                <CommandItem value="dashboard" onSelect={() => go('')}>
                  <ChevronRight />
                  Dashboard
                </CommandItem>
              )}
              {fileMatches.map((page) => {
                const section = sectionForRoute(tree, page.route)
                return (
                  <CommandItem
                    key={page.file}
                    value={`file:${page.file}`}
                    onSelect={() => go(page.route)}
                  >
                    <ChevronRight />
                    <span className="truncate">{page.navLabel || page.title}</span>
                    {section && (
                      <CommandShortcut className="max-w-[40%] truncate">
                        {section.label}
                      </CommandShortcut>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
          {hits.length > 0 && (
            <CommandGroup heading="In notes">
              {hits.map((hit) => {
                const section = sectionForRoute(tree, hit.route)
                return (
                  <CommandItem
                    key={`content:${hit.file}`}
                    value={`content:${hit.file}`}
                    onSelect={() => go(hit.route)}
                  >
                    <ChevronRight />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{hit.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <SnippetHighlight text={hit.snippet} query={query} />
                      </span>
                    </span>
                    {section && (
                      <CommandShortcut className="max-w-[40%] truncate">
                        {section.label}
                      </CommandShortcut>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
        </CommandList>
        <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <Kbd>
            <CornerDownLeft />
          </Kbd>
          Go to file
        </div>
      </Command>
    </CommandDialog>
  )
}

function SnippetHighlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim()
  const at = text.toLowerCase().indexOf(needle.toLowerCase())
  if (!needle || at === -1) return text
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-medium text-foreground">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  )
}
