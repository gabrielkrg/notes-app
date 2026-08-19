import { ChevronRight, FileText, Folder } from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { firstPageRoute, type NavDirNode, type NavNode } from '@/content.ts'

export function FolderFileAccordion({
  folder,
  onGo,
}: {
  folder: NavDirNode | null
  onGo: (route: string) => void
}) {
  const children = folder?.children || []
  if (!children.length) return null

  return (
    <Collapsible className="group/folder-files rounded-xl bg-card ring-1 ring-foreground/10">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/folder-files:rotate-90" />
        <span>Files in this folder</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {children.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <ul className="grid gap-0.5 border-t px-2 py-2">
          {children.map((node) => {
            const href = firstPageRoute(node)
            return (
              <li key={node.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/40"
                  onClick={() => href && onGo(href)}
                >
                  {node.type === 'dir' ? (
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{node.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
