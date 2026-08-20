import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import {
  Check,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  LayoutDashboard,
  Network,
  Paperclip,
  Trash2,
} from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Progress } from '@/components/ui/progress'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { ShortcutHint } from '@/components/search-command'
import { GithubMark } from '@/components/github-mark.tsx'
import { GRAPH_ROUTE, hrefForNode, isGraphRoute, type NavDirNode, type NavNode, type NavPageNode } from '@/content.ts'
import { isGithubVirtualPath } from '@/lib/github-notes.ts'
import { attachedRootForDir } from '@/lib/notes-roots.ts'
import type { DeleteTarget } from '@/lib/note-delete.ts'
import type { NoteKind } from '@/lib/note-name.ts'

type CreateRequest = { kind: NoteKind; parent: string }

function dirOpenId(nodes: NavNode[], route: string) {
  return (
    nodes.find(
      (node) =>
        node.type === 'dir' &&
        (route === node.path || route.startsWith(`${node.path}/`))
    )?.id ?? null
  )
}

function useAccordion(nodes: NavNode[], route: string) {
  const activeId = dirOpenId(nodes, route)
  const [openId, setOpenId] = useState(activeId)

  useEffect(() => {
    if (activeId) setOpenId(activeId)
  }, [activeId])

  return [openId, setOpenId] as const
}

const DEPTH_PAD = [undefined, 'pl-8', 'pl-10', 'pl-12', 'pl-14']
const TREE_LINE = [
  'relative before:pointer-events-none before:absolute before:inset-y-1 before:left-4 before:w-px before:bg-sidebar-border',
  'relative before:pointer-events-none before:absolute before:inset-y-1 before:left-7 before:w-px before:bg-sidebar-border',
  'relative before:pointer-events-none before:absolute before:inset-y-1 before:left-10 before:w-px before:bg-sidebar-border',
]

function depthPad(depth: number) {
  return DEPTH_PAD[Math.min(depth, DEPTH_PAD.length - 1)]
}

function treeLine(depth: number) {
  return TREE_LINE[Math.min(depth, TREE_LINE.length - 1)]
}

function stopMenuBubble(event: { stopPropagation(): void }) {
  event.stopPropagation()
}

function ItemMenu({
  onCreate,
  onDelete,
  onRemove,
  deleteLabel,
  children,
}: {
  onCreate?: (kind: NoteKind) => void
  onDelete?: () => void
  onRemove?: () => void
  deleteLabel?: string
  children: ReactNode
}) {
  const hasMenu = onCreate || onDelete || onRemove
  if (!hasMenu) return children

  return (
    <ContextMenu>
      <ContextMenuTrigger className="contents" onContextMenu={stopMenuBubble}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-auto min-w-40">
        {onCreate && (
          <>
            <ContextMenuItem onSelect={() => onCreate('note')}>
              <FilePlus />
              New note
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onCreate('folder')}>
              <FolderPlus />
              New folder
            </ContextMenuItem>
          </>
        )}
        {onCreate && (onRemove || onDelete) && <ContextMenuSeparator />}
        {onRemove && (
          <ContextMenuItem onSelect={onRemove}>
            <FolderMinus />
            Remove from directory
          </ContextMenuItem>
        )}
        {onRemove && onDelete && <ContextMenuSeparator />}
        {onDelete && (
          <ContextMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 />
            {deleteLabel}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function AppSidebar({
  tree,
  route,
  done,
  doneCount,
  topicCount,
  onGo,
  canCreate = false,
  canCreateAtRoot = canCreate,
  protectRootFolders = false,
  roots = [],
  githubLabels = [],
  onCreate,
  onDelete,
  onRemoveRoot,
}: {
  tree: NavNode[]
  route: string
  done: Set<string>
  doneCount: number
  topicCount: number
  onGo: (route: string) => void
  canCreate?: boolean
  canCreateAtRoot?: boolean
  protectRootFolders?: boolean
  roots?: string[]
  githubLabels?: string[]
  onCreate?: (next: CreateRequest) => void
  onDelete?: (target: DeleteTarget) => void
  onRemoveRoot?: (dir: string) => void
}) {
  const [openId, setOpenId] = useAccordion(tree, route)
  const singleRoot = roots.length === 1 ? roots[0] : null
  const notesGroup = (
    <SidebarGroup>
      <SidebarGroupLabel>Folders</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {tree.map((node) => (
            <NavNode
              key={node.id}
              node={node}
              depth={0}
              route={route}
              done={done}
              onGo={onGo}
              canCreate={canCreate}
              onCreate={onCreate}
              onDelete={onDelete}
              onRemoveRoot={onRemoveRoot}
              roots={roots}
              githubLabels={githubLabels}
              protectRootFolders={protectRootFolders}
              open={openId === node.id}
              onOpenChange={(next: boolean) => setOpenId(next ? node.id : null)}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Dashboard"
              className="hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground data-[active=true]:bg-transparent"
              onClick={() => onGo('')}
            >
              <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Paperclip className="size-4" />
              </span>
              <span className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-heading font-medium">Notes</span>
                <span className="truncate text-xs text-muted-foreground">Personal notes</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Dashboard"
                  isActive={!route}
                  onClick={() => onGo('')}
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Graph"
                  isActive={isGraphRoute(route)}
                  onClick={() => onGo(GRAPH_ROUTE)}
                >
                  <Network />
                  <span>Graph</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <ItemMenu
          onCreate={canCreateAtRoot ? (kind: NoteKind) => onCreate?.({ kind, parent: '' }) : undefined}
          onRemove={singleRoot && onRemoveRoot ? () => onRemoveRoot(singleRoot) : undefined}
        >
          {notesGroup}
        </ItemMenu>
      </SidebarContent>

      <SidebarFooter>
        <div className="grid gap-2 px-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Read</span>
            <span>
              {doneCount}/{topicCount}
            </span>
          </div>
          <Progress value={topicCount ? (doneCount / topicCount) * 100 : 0} />
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShortcutHint />
            search · [ ] previous next
          </p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function NavNode({
  node,
  depth,
  route,
  done,
  onGo,
  open,
  onOpenChange,
  canCreate,
  onCreate,
  onDelete,
  onRemoveRoot,
  roots = [],
  githubLabels = [],
  protectRootFolders = false,
}: {
  node: NavNode
  depth: number
  route: string
  done: Set<string>
  onGo: (route: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  canCreate?: boolean
  onCreate?: (next: CreateRequest) => void
  onDelete?: (target: DeleteTarget) => void
  onRemoveRoot?: (dir: string) => void
  roots?: string[]
  githubLabels?: string[]
  protectRootFolders?: boolean
}) {
  if (node.type === 'page') {
    return (
      <PageLink
        node={node}
        depth={depth}
        route={route}
        done={done}
        onGo={onGo}
        onDelete={onDelete}
      />
    )
  }

  return (
    <FolderNode
      node={node}
      depth={depth}
      route={route}
      done={done}
      onGo={onGo}
      open={open}
      onOpenChange={onOpenChange}
      canCreate={canCreate}
      onCreate={onCreate}
      onDelete={onDelete}
      onRemoveRoot={onRemoveRoot}
      roots={roots}
      githubLabels={githubLabels}
      protectRootFolders={protectRootFolders}
    />
  )
}

function FolderNode({
  node,
  depth,
  route,
  done,
  onGo,
  open,
  onOpenChange,
  canCreate,
  onCreate,
  onDelete,
  onRemoveRoot,
  roots = [],
  githubLabels = [],
  protectRootFolders = false,
}: {
  node: NavDirNode
  depth: number
  route: string
  done: Set<string>
  onGo: (route: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  canCreate?: boolean
  onCreate?: (next: CreateRequest) => void
  onDelete?: (target: DeleteTarget) => void
  onRemoveRoot?: (dir: string) => void
  roots?: string[]
  githubLabels?: string[]
  protectRootFolders?: boolean
}) {
  const active = route === node.path
  const githubLocked = isGithubVirtualPath(node.path, githubLabels)
  const isGithubRoot = depth === 0 && githubLabels.includes(node.path)
  const Icon = open ? FolderOpen : Folder
  const children = node.children || []
  const [childOpenId, setChildOpenId] = useAccordion(children, route)
  const canDeleteFolder = Boolean(onDelete) && !githubLocked && !(protectRootFolders && depth === 0)
  const attachedRoot = depth === 0 ? attachedRootForDir(roots, node.path) : null
  const canRemoveRoot = Boolean(onRemoveRoot && attachedRoot)

  function handleOpenChange(next: boolean) {
    const href = hrefForNode(node)
    if (href && href !== route) {
      onOpenChange(true)
      onGo(href)
      return
    }
    onOpenChange(next)
  }

  const label = (
    <>
      {children.length > 0 && (
        <ChevronRight
          className={`shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden ${open ? 'rotate-90' : ''}`}
        />
      )}
      <Icon />
      <span className="min-w-0 truncate group-data-[collapsible=icon]:hidden">{node.label}</span>
      {isGithubRoot && (
        <GithubMark className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      )}
    </>
  )

  const nested = children.length > 0 && (
    <CollapsibleContent className={treeLine(depth)}>
      <SidebarMenu className="mt-0.5 gap-0.5 group-data-[collapsible=icon]:hidden">
        {children.map((child) => (
          <NavNode
            key={child.id}
            node={child}
            depth={depth + 1}
            route={route}
            done={done}
            onGo={onGo}
            canCreate={canCreate}
            onCreate={onCreate}
            onDelete={onDelete}
            onRemoveRoot={onRemoveRoot}
            roots={roots}
            githubLabels={githubLabels}
            protectRootFolders={protectRootFolders}
            open={childOpenId === child.id}
            onOpenChange={(next: boolean) => setChildOpenId(next ? child.id : null)}
          />
        ))}
      </SidebarMenu>
    </CollapsibleContent>
  )

  return (
    <Collapsible asChild open={open} onOpenChange={handleOpenChange}>
      <SidebarMenuItem className="group/collapsible">
        <ItemMenu
          onCreate={
            canCreate && !githubLocked ? (kind: NoteKind) => onCreate?.({ kind, parent: node.path }) : undefined
          }
          onRemove={attachedRoot && onRemoveRoot ? () => onRemoveRoot(attachedRoot) : undefined}
          onDelete={
            canDeleteFolder && onDelete
              ? () =>
                  onDelete({
                    kind: 'folder',
                    name: node.label,
                    path: node.path,
                    expectedNames: [node.label],
                  })
              : undefined
          }
          deleteLabel="Delete folder"
        >
          <SidebarMenuButton
            asChild
            isActive={active}
            tooltip={depth === 0 ? node.label : undefined}
            className={depthPad(depth)}
          >
            <CollapsibleTrigger>{label}</CollapsibleTrigger>
          </SidebarMenuButton>
        </ItemMenu>
        {nested}
      </SidebarMenuItem>
    </Collapsible>
  )
}

function PageLink({
  node,
  depth,
  route,
  done,
  onGo,
  onDelete,
}: {
  node: NavPageNode
  depth: number
  route: string
  done: Set<string>
  onGo: (route: string) => void
  onDelete?: (target: DeleteTarget) => void
}) {
  const page = node.page
  const active = route === page.route
  const label = (
    <>
      <FileText />
      <span className="min-w-0 truncate">{node.label}</span>
      {done.has(page.file) && (
        <Check className="ml-auto size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      )}
    </>
  )

  const goToNote = (event: MouseEvent) => {
    event.preventDefault()
    onGo(page.route)
  }

  return (
    <SidebarMenuItem>
      <ItemMenu
        onDelete={
          onDelete && !page.readonly
            ? () => onDelete({ kind: 'note', name: node.label, file: page.file })
            : undefined
        }
        deleteLabel="Delete"
      >
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={depth === 0 ? node.label : undefined}
          className={depthPad(depth)}
        >
          <a href={`#/${page.route}`} onClick={goToNote}>
            {label}
          </a>
        </SidebarMenuButton>
      </ItemMenu>
    </SidebarMenuItem>
  )
}
