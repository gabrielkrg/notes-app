import { createContext, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import {
  Bookmark,
  ChevronRight,
  FilePen,
  FileText,
  Folder,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  LayoutDashboard,
  Network,
  Paperclip,
  Pencil,
  Settings,
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
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { ShortcutHint } from '@/components/search-command'
import { GithubMark } from '@/components/github-mark.tsx'
import { GRAPH_ROUTE, hrefForNode, isGraphRoute, compareNavNodes, type NavDirNode, type NavNode, type NavPageNode } from '@/content.ts'
import { isGithubVirtualPath } from '@/lib/github-notes.ts'
import { attachedRootForDir } from '@/lib/notes-roots.ts'
import { depthPad, dirOpenId, ensureOpenId, folderOpenChange, toggleOpenId, treeLine } from '@/lib/sidebar-tree.ts'
import type { DeleteTarget } from '@/lib/note-delete.ts'
import type { NoteKind } from '@/lib/note-name.ts'
import type { RenameTarget } from '@/lib/note-rename.ts'

type CreateRequest = { kind: NoteKind; parent: string }

function menuNodes(nodes: NavNode[]) {
  return [...nodes].sort(compareNavNodes)
}

const FolderCollapseContext = createContext({
  token: 0,
  collapseAll: () => {},
})

function useOpenFolders(nodes: NavNode[], route: string, token: number) {
  const activeId = dirOpenId(nodes, route)
  const [openIds, setOpenIds] = useState<string[]>(() => (activeId ? [activeId] : []))
  const lastActiveId = useRef(activeId)

  useEffect(() => {
    if (token === 0) return
    setOpenIds([])
  }, [token])

  useEffect(() => {
    if (lastActiveId.current === activeId) return
    lastActiveId.current = activeId
    setOpenIds((current) => ensureOpenId(current, activeId))
  }, [activeId])

  function setOpen(id: string, next: boolean) {
    setOpenIds((current) => toggleOpenId(current, id, next))
  }

  function closeAll() {
    setOpenIds([])
  }

  return [openIds, setOpen, closeAll] as const
}

function stopMenuBubble(event: { stopPropagation(): void }) {
  event.stopPropagation()
}

function TreeTwist({
  open = false,
  expandable,
  onToggle,
}: {
  open?: boolean
  expandable: boolean
  onToggle?: (event: MouseEvent) => void
}) {
  if (!expandable) {
    return <span className="size-4 shrink-0 group-data-[collapsible=icon]:hidden" aria-hidden />
  }

  const chevron = (
    <ChevronRight
      className={`shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden ${open ? 'rotate-90' : ''}`}
    />
  )

  if (!onToggle) return chevron

  return (
    <span
      className="-m-1 flex shrink-0 items-center p-1 group-data-[collapsible=icon]:hidden"
      onClick={onToggle}
    >
      {chevron}
    </span>
  )
}

function ItemMenu({
  onCreate,
  onRename,
  onDelete,
  onRemove,
  deleteLabel,
  children,
}: {
  onCreate?: (kind: NoteKind) => void
  onRename?: () => void
  onDelete?: () => void
  onRemove?: () => void
  deleteLabel?: string
  children: ReactNode
}) {
  const hasMenu = onCreate || onRename || onDelete || onRemove
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
              <FilePen />
              New note
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onCreate('folder')}>
              <FolderPlus />
              New folder
            </ContextMenuItem>
          </>
        )}
        {onRename && (
          <ContextMenuItem onSelect={onRename}>
            <Pencil />
            Rename
          </ContextMenuItem>
        )}
        {(onCreate || onRename) && (onRemove || onDelete) && <ContextMenuSeparator />}
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

type AppSidebarProps = {
  tree: NavNode[]
  route: string
  bookmarks: string[]
  onGo: (route: string) => void
  canCreate?: boolean
  canCreateAtRoot?: boolean
  roots?: string[]
  githubLabels?: string[]
  onCreate?: (next: CreateRequest) => void
  onDelete?: (target: DeleteTarget) => void
  onRename?: (target: RenameTarget) => void
  onRemoveRoot?: (dir: string) => void
  onOpenSettings?: () => void
  onOpenBookmarks?: () => void
}

export function AppSidebar({
  tree,
  route,
  bookmarks,
  onGo,
  canCreate = false,
  canCreateAtRoot = canCreate,
  roots = [],
  githubLabels = [],
  onCreate,
  onDelete,
  onRename,
  onRemoveRoot,
  onOpenSettings,
  onOpenBookmarks,
}: AppSidebarProps) {
  const [token, setToken] = useState(0)
  const [openIds, setOpen, closeAll] = useOpenFolders(tree, route, token)
  const collapseAll = () => {
    closeAll()
    setToken((n) => n + 1)
  }
  const singleRoot = roots.length === 1 ? roots[0] : null
  const notesGroup = (
    <SidebarGroup>
      <div className="group/folders-label relative">
        <SidebarGroupLabel>Folders</SidebarGroupLabel>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarGroupAction
              aria-label="Collapse folders"
              onClick={collapseAll}
              className="top-1.5 right-1 opacity-0 transition-opacity group-hover/folders-label:opacity-100 group-focus-within/folders-label:opacity-100 focus-visible:opacity-100"
            >
              <FolderMinus />
            </SidebarGroupAction>
          </TooltipTrigger>
          <TooltipContent>Collapse folders</TooltipContent>
        </Tooltip>
      </div>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {menuNodes(tree).map((node) => (
            <NavNode
              key={node.id}
              node={node}
              depth={0}
              route={route}
              bookmarks={bookmarks}
              onGo={onGo}
              canCreate={canCreate}
              onCreate={onCreate}
              onDelete={onDelete}
              onRename={onRename}
              onRemoveRoot={onRemoveRoot}
              roots={roots}
              githubLabels={githubLabels}
              open={openIds.includes(node.id)}
              onOpenChange={(next: boolean) => setOpen(node.id, next)}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )

  return (
    <FolderCollapseContext.Provider value={{ token, collapseAll }}>
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
              <span className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground [&_svg]:size-[80%]!">
                <Paperclip strokeWidth={2.25} />
              </span>
              <span className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-heading font-medium">Notes</span>
                <span className="truncate text-xs text-muted-foreground">Personal notes</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {canCreate ? (
          <div className="flex items-center gap-2 px-2 pb-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
            <CreateRootButton
              label="New note"
              disabled={!canCreateAtRoot}
              onClick={() => onCreate?.({ kind: 'note', parent: '' })}
            >
              <FilePen />
            </CreateRootButton>
            <CreateRootButton
              label="New folder"
              disabled={!canCreateAtRoot}
              onClick={() => onCreate?.({ kind: 'folder', parent: '' })}
            >
              <FolderPlus />
            </CreateRootButton>
          </div>
        ) : null}
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
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Bookmarks" onClick={onOpenBookmarks}>
                  <Bookmark />
                  <span>Bookmarks</span>
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" onClick={onOpenSettings}>
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
    </FolderCollapseContext.Provider>
  )
}

function CreateRootButton({
  label,
  disabled,
  onClick,
  shortcut,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  shortcut?: string
  children: ReactNode
}) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      disabled={disabled}
      className="cursor-pointer text-sidebar-foreground hover:text-sidebar-foreground"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {disabled ? <span className="inline-flex">{button}</span> : button}
      </TooltipTrigger>
      <TooltipContent>
        {disabled ? (
          'Set a default notes folder in Settings'
        ) : (
          <>
            {label}
            {shortcut ? <ShortcutHint keyLabel={shortcut} /> : null}
          </>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function NavNode({
  node,
  depth,
  route,
  bookmarks,
  onGo,
  open,
  onOpenChange,
  canCreate,
  onCreate,
  onDelete,
  onRename,
  onRemoveRoot,
  roots = [],
  githubLabels = [],
}: {
  node: NavNode
  depth: number
  route: string
  bookmarks: string[]
  onGo: (route: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  canCreate?: boolean
  onCreate?: (next: CreateRequest) => void
  onDelete?: (target: DeleteTarget) => void
  onRename?: (target: RenameTarget) => void
  onRemoveRoot?: (dir: string) => void
  roots?: string[]
  githubLabels?: string[]
}) {
  if (node.type === 'page') {
    return (
      <PageLink
        node={node}
        depth={depth}
        route={route}
        bookmarks={bookmarks}
        onGo={onGo}
        onDelete={onDelete}
        onRename={onRename}
      />
    )
  }

  return (
    <FolderNode
      node={node}
      depth={depth}
      route={route}
      bookmarks={bookmarks}
      onGo={onGo}
      open={open}
      onOpenChange={onOpenChange}
      canCreate={canCreate}
      onCreate={onCreate}
      onDelete={onDelete}
      onRename={onRename}
      onRemoveRoot={onRemoveRoot}
      roots={roots}
      githubLabels={githubLabels}
    />
  )
}

function FolderNode({
  node,
  depth,
  route,
  bookmarks,
  onGo,
  open,
  onOpenChange,
  canCreate,
  onCreate,
  onDelete,
  onRename,
  onRemoveRoot,
  roots = [],
  githubLabels = [],
}: {
  node: NavDirNode
  depth: number
  route: string
  bookmarks: string[]
  onGo: (route: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  canCreate?: boolean
  onCreate?: (next: CreateRequest) => void
  onDelete?: (target: DeleteTarget) => void
  onRename?: (target: RenameTarget) => void
  onRemoveRoot?: (dir: string) => void
  roots?: string[]
  githubLabels?: string[]
}) {
  const active = route === node.path
  const githubLocked = isGithubVirtualPath(node.path, githubLabels)
  const isGithubRoot = depth === 0 && githubLabels.includes(node.path)
  const Icon = open ? FolderOpen : Folder
  const children = node.children || []
  const { token } = useContext(FolderCollapseContext)
  const [childOpenIds, setChildOpen] = useOpenFolders(children, route, token)
  const attachedRoot = depth === 0 ? attachedRootForDir(roots, node.path) : null
  const canDeleteFolder = Boolean(onDelete) && !githubLocked && !attachedRoot
  const canRenameFolder = Boolean(onRename) && !githubLocked && !attachedRoot
  const canRemoveRoot = Boolean(onRemoveRoot && attachedRoot)
  const { isMobile, setOpenMobile } = useSidebar()

  function handleOpenChange(next: boolean) {
    const change = folderOpenChange(next, hrefForNode(node), route)
    onOpenChange(change.open)
    if (change.go) onGo(change.go)
  }

  // On mobile the twist and the folder name do different things: the twist only
  // expands/collapses the tree, the name navigates and dismisses the drawer.
  function handleTwist(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    onOpenChange(!open)
  }

  function handleName(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    const href = hrefForNode(node)
    onOpenChange(true)
    if (href !== route) onGo(href)
    setOpenMobile(false)
  }

  const label = (
    <>
      <TreeTwist
        open={open}
        expandable={children.length > 0}
        onToggle={isMobile && children.length > 0 ? handleTwist : undefined}
      />
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
        {menuNodes(children).map((child) => (
          <NavNode
            key={child.id}
            node={child}
            depth={depth + 1}
            route={route}
            bookmarks={bookmarks}
            onGo={onGo}
            canCreate={canCreate}
            onCreate={onCreate}
            onDelete={onDelete}
            onRename={onRename}
            onRemoveRoot={onRemoveRoot}
            roots={roots}
            githubLabels={githubLabels}
            open={childOpenIds.includes(child.id)}
            onOpenChange={(next: boolean) => setChildOpen(child.id, next)}
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
          onRename={
            canRenameFolder && onRename
              ? () =>
                  onRename({
                    kind: 'folder',
                    name: node.label,
                    path: node.path,
                  })
              : undefined
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
            <CollapsibleTrigger onClick={isMobile ? handleName : undefined}>{label}</CollapsibleTrigger>
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
  bookmarks,
  onGo,
  onDelete,
  onRename,
}: {
  node: NavPageNode
  depth: number
  route: string
  bookmarks: string[]
  onGo: (route: string) => void
  onDelete?: (target: DeleteTarget) => void
  onRename?: (target: RenameTarget) => void
}) {
  const page = node.page
  const active = route === page.route
  const label = (
    <>
      <TreeTwist expandable={false} />
      <FileText />
      <span className="min-w-0 truncate">{node.label}</span>
      {bookmarks.includes(page.file) && (
        <Bookmark className="ml-auto size-3.5 shrink-0 fill-current text-muted-foreground group-data-[collapsible=icon]:hidden" />
      )}
    </>
  )

  const { isMobile, setOpenMobile } = useSidebar()

  const goToNote = (event: MouseEvent) => {
    event.preventDefault()
    onGo(page.route)
    if (isMobile) setOpenMobile(false)
  }

  return (
    <SidebarMenuItem>
      <ItemMenu
        onRename={
          onRename && !page.readonly
            ? () => onRename({ kind: 'note', name: node.label, file: page.file })
            : undefined
        }
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
