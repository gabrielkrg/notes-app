import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, CornerDownLeft, Search } from 'lucide-react'

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
import { cn } from '@/lib/utils'

function useIsMac() {
  const [mac, setMac] = useState(() =>
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent),
  )
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.userAgent))
  }, [])
  return mac
}

export function ShortcutHint({ className }: { className?: string }) {
  const mac = useIsMac()
  return (
    <KbdGroup className={className}>
      <Kbd>{mac ? '⌘' : 'Ctrl'}</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  )
}

export function SearchTrigger({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'inline-flex h-8 w-full items-center gap-2 rounded-full border border-input bg-muted/50 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted',
        className,
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">Search notes…</span>
      <ShortcutHint />
    </button>
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

  function go(route: string) {
    onGo(route)
    onOpenChange(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search notes"
      description="Jump to a file"
    >
      <Command>
        <CommandInput placeholder="Search notes…" />
        <CommandList>
          <CommandEmpty>No files found.</CommandEmpty>
          <CommandGroup heading="Files">
            <CommandItem value="dashboard" onSelect={() => go('')}>
              <ChevronRight />
              Dashboard
            </CommandItem>
            {pages.map((page) => {
              const section = sectionForRoute(tree, page.route)
              return (
                <CommandItem
                  key={page.file}
                  value={`${page.title} ${page.navLabel} ${page.route}`}
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
