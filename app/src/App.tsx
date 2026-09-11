import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  Pencil,
  RefreshCw,
  Save,
  Settings,
  SquareArrowOutUpRight,
  Trash2,
  Globe,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react'

import { AppSidebar } from '@/components/app-sidebar'
import { GithubMark } from '@/components/github-mark.tsx'
import { GlobalGraph } from '@/components/global-graph'
import { FolderFileAccordion } from '@/components/folder-file-accordion'
import { CreateNoteDialog } from '@/components/create-note-dialog'
import { DeleteNoteDialog } from '@/components/delete-note-dialog'
import { RenameNoteDialog } from '@/components/rename-note-dialog'
import { BookmarksDialog } from '@/components/bookmarks-dialog'
import { SettingsDialog } from '@/components/settings-dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { NoteEditor, type NoteEditorHandle } from '@/components/note-editor'
import { CodeEditor, type CodeEditorHandle } from '@/components/code-editor'
import { PlainText, type PlainTextHandle } from '@/components/plain-text'
import { FindBar } from '@/components/find-bar'
import { HtmlPreview, type HtmlPreviewHandle } from '@/components/html-preview'
import { rewriteHtmlPreview } from '@/lib/html-preview.ts'
import { SearchCommand, SearchTrigger, ShortcutHint } from '@/components/search-command'
import { WindowControls } from '@/components/window-controls'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HighlightProvider } from '@/lib/highlight-provider.tsx'
import { AppearanceProvider } from '@/lib/appearance-provider'
import { ThemeProvider } from '@/lib/theme'
import { bookmarkEntries, persistBookmarks, readBookmarks, toggleBookmark } from '@/lib/bookmarks.ts'
import { noteEditorHref, storageKey } from '@/lib/config.ts'
import { isDesktop } from '@/lib/desktop'
import type { CreatedNote } from '@/lib/desktop.ts'
import { fetchBrowserGithubNotes } from '@/lib/github-client.ts'
import { isGithubVirtualPath, topLevelLabels } from '@/lib/github-notes.ts'
import { CtrlKChord, isCancelEditShortcut, isEditNoteShortcut, isHtmlFullscreenShortcut, isNewNoteShortcut, isReloadFoldersShortcut, isSettingsShortcut } from '@/lib/key-chords'
import { isMobilePlatform } from '@/lib/title-bar.ts'
import { clearFindHighlight, collectText, revealInElement } from '@/lib/find-dom.ts'
import {
  isFindNextShortcut,
  isFindPrevShortcut,
  isFindShortcut,
  runFind,
  stepFindIndex,
  type FindResult,
} from '@/lib/find-in-page.ts'
import { attachedRootForDir, labelForRoot, labelNotesRoots } from '@/lib/notes-roots.ts'
import type { DeleteTarget } from '@/lib/note-delete.ts'
import type { NoteKind } from '@/lib/note-name.ts'
import type { RenameTarget } from '@/lib/note-rename.ts'
import { fileKind } from '@/lib/note-name.ts'
import { SplitPane } from '@/components/split-pane'
import {
  formatSplitWidth,
  loadSplitWidth,
  saveSplitWidth,
  splitWidthFromPointer,
} from '@/lib/split-width.ts'
import { toggleTaskInNote } from '@/lib/md-task.ts'
import { splitFrontmatter } from '@/lib/md-wysiwyg.ts'
import MarkdownView from './MarkdownView.tsx'
import {
  bundledContent,
  bundledRawPages,
  buildContent,
  countTopicPages,
  crumbsForRoute,
  dirForIndex,
  dirForRoute,
  hoistNavRoot,
  hrefForNode,
  isGraphRoute,
  neighbors,
  overviewNodes,
  pageByRoute,
  parseHash,
  routeFor,
  sectionForRoute,
  setHash,
  type Content,
  type NavDirNode,
  type NavNode,
  type NotePage,
  type Pages,
} from './content.ts'

type CreateState = { kind: NoteKind; parent: string }

const PAGE_SHELL = 'mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8'
const LAST_KEY = storageKey('last')

function underPath(route: string, path: string) {
  return route === path || route.startsWith(`${path}/`)
}

function noteRelPath(file: string) {
  return file
}

function openNoteFile(event: MouseEvent<HTMLAnchorElement>, file: string) {
  if (window.desktop?.openNote) {
    event.preventDefault()
    window.desktop.openNote(file)
  }
}

function emptyContent(): Content {
  return { pages: {}, navTree: [], topicPages: [], topicCount: 0, githubLabels: [], githubNames: {} }
}

export default function App() {
  const desktop = isDesktop()
  const [content, setContent] = useState<Content>(() => (desktop ? emptyContent() : bundledContent))
  const [roots, setRoots] = useState<string[]>([])
  const [defaultRoot, setDefaultRoot] = useState('')
  const [loading, setLoading] = useState(desktop)
  const [loadError, setLoadError] = useState('')
  const [githubError, setGithubError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [routes, setRoutes] = useState(() => parseHash())
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const [createState, setCreateState] = useState<CreateState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bookmarks, setBookmarks] = useState<string[]>(readBookmarks)
  const [splitWidth, setSplitWidth] = useState(() => loadSplitWidth(localStorage))
  const contentRef = useRef<HTMLDivElement>(null)
  const splitRowRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<NoteEditorHandle | CodeEditorHandle | PlainTextHandle | null>(null)
  const chordRef = useRef<CtrlKChord | null>(null)
  const noteRawRef = useRef('')
  const taskWriteRef = useRef(Promise.resolve())
  if (!chordRef.current) chordRef.current = new CtrlKChord()

  const tree = content.navTree
  const defaultLabel = labelForRoot(roots, defaultRoot)
  const canCreateAtRoot = desktop && (Boolean(defaultLabel) || roots.length === 0)
  const route = routes.route
  const split = routes.split
  const showingGraph = isGraphRoute(route)
  const page = showingGraph ? null : pageByRoute(content.pages, route)
  const splitPage = split ? pageByRoute(content.pages, split) : null
  const showSplit = Boolean(split) && !showingGraph && !loading && !loadError
  const folderOverview = !page && !showingGraph ? dirForRoute(tree, route) : null
  const showingDashboard = !page && !showingGraph && !folderOverview
  const section = sectionForRoute(tree, route)
  const crumbs = crumbsForRoute(tree, route)
  const { prev, next } = neighbors(tree, route)
  const last = localStorage.getItem(LAST_KEY)
  const previewFiles = useMemo(
    () => Object.fromEntries(Object.values(content.pages).map((item) => [item.file, item.raw])),
    [content.pages],
  )

  async function reloadNotes() {
    setLoadError('')
    setGithubError('')
    try {
      if (window.desktop?.listNotes) {
        let currentRoots = roots
        if (window.desktop.getNotesRoots) {
          currentRoots = await window.desktop.getNotesRoots()
          setRoots(currentRoots)
        }
        let currentDefault = defaultRoot
        if (window.desktop.getDefaultNotesRoot) {
          currentDefault = await window.desktop.getDefaultNotesRoot()
          setDefaultRoot(currentDefault)
        }
        const snapshot = await window.desktop.listNotes()
        const built = buildContent(snapshot.files, {
          githubFiles: snapshot.githubFiles,
          githubNames: snapshot.githubNames,
          localRootLabels: labelNotesRoots(currentRoots).map((item) => item.label),
        })
        setContent({
          ...built,
          navTree: hoistNavRoot(built.navTree, labelForRoot(currentRoots, currentDefault)),
        })
        if (window.desktop.getGithubSyncErrors) {
          const errors = await window.desktop.getGithubSyncErrors()
          setGithubError(errors.map((item) => item.message).filter(Boolean).join(' '))
        }
        return
      }
      const github = await fetchBrowserGithubNotes(topLevelLabels(bundledRawPages))
      setContent(
        buildContent(
          { ...github.files, ...bundledRawPages },
          { githubFiles: github.githubFiles, githubNames: github.githubNames },
        ),
      )
      setGithubError(github.errors.map((item) => item.message).filter(Boolean).join(' '))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not read notes')
      setContent(emptyContent())
    } finally {
      setLoading(false)
    }
  }

  async function refreshFolders() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await reloadNotes()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    reloadNotes()
  }, [desktop])

  useEffect(() => {
    const onHash = () => setRoutes(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (route && !isGraphRoute(route)) localStorage.setItem(LAST_KEY, route)
    contentRef.current?.scrollTo(0, 0)
  }, [route])

  useEffect(() => {
    noteRawRef.current = page?.raw || ''
  }, [page?.file, page?.raw])

  useEffect(() => {
    if (!editing || dirty) return
    setDraft(page?.raw || '')
  }, [editing, dirty, page?.file, page?.raw])

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (isSettingsShortcut(event)) {
        event.preventDefault()
        if (!confirmLeave()) return
        setSettingsOpen(true)
        return
      }
      if (isReloadFoldersShortcut(event)) {
        event.preventDefault()
        void refreshFolders()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        if (!editing) return
        event.preventDefault()
        saveDraft()
        return
      }
      if (isCancelEditShortcut(event) && editing) {
        if (searchOpen) return
        if (event.target instanceof Element && event.target.closest('[role="dialog"]')) return
        event.preventDefault()
        cancelEditing()
        return
      }
      if (desktop && canCreateAtRoot && isNewNoteShortcut(event)) {
        event.preventDefault()
        createQuickNote()
        return
      }
      if (desktop) {
        const handled = chordRef.current?.handle(event, {
          searchOpen,
          onSearch: () => setSearchOpen((open) => !open),
          onOpenFolder: () => {
            addNotesFolder().catch((err: unknown) => {
              window.alert(err instanceof Error ? err.message : 'Could not add that folder')
            })
          },
        })
        if (handled) return
      }
      if (!(event.target instanceof HTMLElement)) return
      if (event.target.matches('input, textarea') || event.target.isContentEditable) return
      if (isEditNoteShortcut(event) && desktop && page && !editing && !page.readonly) {
        event.preventDefault()
        startEditing()
        return
      }
      if (event.key === '/') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === '[' && prev) go(prev.route)
      if (event.key === ']' && next) go(next.route)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, editing, dirty, draft, page, desktop, searchOpen, canCreateAtRoot, defaultLabel, refreshing])

  useEffect(() => {
    return () => chordRef.current?.dispose()
  }, [])

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  function confirmLeave() {
    if (!dirty) return true
    return window.confirm('Discard unsaved changes?')
  }

  function applyRoutes(nextRoute: string, nextSplit = split) {
    const cleanSplit = nextSplit === nextRoute ? '' : nextSplit
    setHash(nextRoute, cleanSplit)
    setRoutes({ route: nextRoute, split: cleanSplit })
  }

  function go(nextRoute: string) {
    if (!confirmLeave()) return
    setEditing(false)
    setDirty(false)
    applyRoutes(nextRoute)
  }

  function openSplit(nextSplit: string) {
    if (isGraphRoute(nextSplit) || nextSplit === route) return
    applyRoutes(route, nextSplit)
  }

  function closeSplit() {
    applyRoutes(route, '')
  }

  function startSplitDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const row = splitRowRef.current
    if (!row) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = splitWidth
    const containerPx = row.getBoundingClientRect().width
    const widthAt = (clientX: number) =>
      splitWidthFromPointer(startWidth, clientX - startX, containerPx)
    const onMove = (moved: globalThis.PointerEvent) => setSplitWidth(widthAt(moved.clientX))
    const onUp = (up: globalThis.PointerEvent) => {
      const next = widthAt(up.clientX)
      setSplitWidth(next)
      saveSplitWidth(localStorage, next)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function swapPanes() {
    if (!split) return
    if (!confirmLeave()) return
    setEditing(false)
    setDirty(false)
    applyRoutes(split, route)
  }

function startEditing() {
    if (page?.readonly) return
    setDraft(page?.raw || '')
    setDirty(false)
    setEditing(true)
  }

  function cancelEditing() {
    if (!editing) return
    if (!confirmLeave()) return
    setDraft(page?.raw || '')
    setDirty(false)
    setEditing(false)
  }

  async function saveDraft() {
    if (!page || !window.desktop?.writeNote) return
    const latest = editorRef.current?.flush?.() ?? draft
    setDraft(latest)
    setSaving(true)
    try {
      await window.desktop.writeNote(page.file, latest)
      await reloadNotes()
      setDirty(false)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not save the note')
    } finally {
      setSaving(false)
    }
  }

  function toggleTask(index: number) {
    if (!page || page.readonly || !window.desktop?.writeNote) return
    const nextRaw = toggleTaskInNote(noteRawRef.current, index)
    if (nextRaw === noteRawRef.current) return
    noteRawRef.current = nextRaw
    const { body } = splitFrontmatter(nextRaw)
    const file = page.file
    setContent((current) => {
      const currentPage = current.pages[file]
      if (!currentPage) return current
      return {
        ...current,
        pages: {
          ...current.pages,
          [file]: { ...currentPage, raw: nextRaw, body },
        },
      }
    })
    const write = window.desktop.writeNote
    taskWriteRef.current = taskWriteRef.current.then(async () => {
      try {
        await write(file, noteRawRef.current)
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Could not save the note')
        await reloadNotes()
      }
    })
  }

  function toggleBookmarked(file: string) {
    setBookmarks((current) => persistBookmarks(toggleBookmark(current, file)))
  }

  async function addNotesFolder() {
    if (!window.desktop?.pickNotesFolder || !window.desktop?.setNotesRoots) return
    const picked = await window.desktop.pickNotesFolder()
    if (!picked) return
    const current = window.desktop.getNotesRoots
      ? await window.desktop.getNotesRoots()
      : roots
    if (current.some((root) => root === picked)) return
    await window.desktop.setNotesRoots([...current, picked])
    await reloadNotes()
  }

  async function removeNotesFolder(dir: string) {
    if (!window.desktop?.setNotesRoots) return
    if (!confirmLeave()) return
    const labeled = labelNotesRoots(roots)
    const removed = labeled.find((item) => item.root === dir)
    const gone = (target: string) =>
      Boolean(removed) && Boolean(target) && underPath(target, removed!.label)
    const leave = roots.length <= 1 || gone(route)
    await window.desktop.setNotesRoots(roots.filter((root) => root !== dir))
    setEditing(false)
    setDirty(false)
    await reloadNotes()
    const nextSplit = gone(split) ? '' : split
    if (leave) applyRoutes('', nextSplit)
    else if (nextSplit !== split) applyRoutes(route, nextSplit)
  }

  async function handleCreated(created: CreatedNote) {
    await reloadNotes()
    const nextRoute = routeFor(created.file)
    applyRoutes(nextRoute)
    setDraft(created.raw)
    setDirty(false)
    setEditing(true)
  }

  async function createQuickNote() {
    if (!window.desktop?.createNote) return
    if (!confirmLeave()) return
    try {
      const created = await window.desktop.createNote({
        parent: defaultLabel,
        type: 'markdown',
      })
      await handleCreated(created)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not create that note')
    }
  }

  function requestDelete(target: DeleteTarget) {
    if (!confirmLeave()) return
    setDeleteTarget(target)
  }

  function requestRename(target: RenameTarget) {
    if (!confirmLeave()) return
    setRenameTarget(target)
  }

  async function handleRenamed(target: RenameTarget, result: { file?: string; path?: string }) {
    setEditing(false)
    setDirty(false)
    await reloadNotes()
    const renamed = (current: string, currentFile: string | undefined) => {
      if (target.kind === 'note' && result.file && currentFile === target.file) {
        return routeFor(result.file)
      }
      if (target.kind === 'folder' && result.path && current && underPath(current, target.path)) {
        return `${result.path}${current.slice(target.path.length)}`
      }
      return current
    }
    const nextRoute = renamed(route, page?.file)
    const nextSplit = renamed(split, splitPage?.file)
    if (nextRoute !== route || nextSplit !== split) applyRoutes(nextRoute, nextSplit)
    setRenameTarget(null)
  }

  async function handleDeleted(target: DeleteTarget) {
    const folderPath = target?.kind === 'folder' ? target.path : ''
    const deletedFile = target?.kind === 'note' ? target.file : ''
    const dropped = (current: string, currentFile: string | undefined) =>
      Boolean(
        (folderPath && current && underPath(current, folderPath)) ||
          (deletedFile && currentFile === deletedFile),
      )
    const shouldLeave = dropped(route, page?.file)

    setEditing(false)
    setDirty(false)
    await reloadNotes()
    const nextSplit = dropped(split, splitPage?.file) ? '' : split
    if (shouldLeave) applyRoutes('', nextSplit)
    else if (nextSplit !== split) applyRoutes(route, nextSplit)
    setDeleteTarget(null)
  }

  return (
    <ThemeProvider>
      <AppearanceProvider>
      <HighlightProvider>
        <TooltipProvider>
        <SidebarProvider className="h-svh flex-col overflow-hidden">
          <header className="titlebar relative z-20 flex shrink-0 items-stretch border-b bg-background">
            <div className="titlebar-inner flex min-w-0 flex-1 items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <SearchTrigger onOpen={() => setSearchOpen(true)} />
                </TooltipTrigger>
                <TooltipContent>
                  Search notes
                  <ShortcutHint />
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Reload folders"
                    aria-keyshortcuts="F5"
                    disabled={refreshing}
                    onClick={() => void refreshFolders()}
                  >
                    <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Reload folders
                  <Kbd>F5</Kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Settings"
                    onClick={() => {
                      if (!confirmLeave()) return
                      setSettingsOpen(true)
                    }}
                  >
                    <Settings />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Settings
                  <ShortcutHint keyLabel="," />
                </TooltipContent>
              </Tooltip>
              <Breadcrumb className="min-w-0 flex-1">
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden sm:block">
                    {showingDashboard ? (
                      <BreadcrumbPage>Dashboard</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href="#/"
                        onClick={(event) => {
                          event.preventDefault()
                          go('')
                        }}
                      >
                        Dashboard
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {showingGraph && (
                    <>
                      <BreadcrumbSeparator className="hidden sm:block" />
                      <BreadcrumbItem>
                        <BreadcrumbPage>Graph</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                  {crumbs.map((crumb, index) => {
                    const lastCrumb = index === crumbs.length - 1
                    const href = crumb.page?.route || crumb.path
                    return (
                      <Fragment key={crumb.id}>
                        <BreadcrumbSeparator className={index === 0 ? 'hidden sm:block' : undefined} />
                        <BreadcrumbItem>
                          {lastCrumb ? (
                            <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink
                              href={`#/${href}`}
                              onClick={(event) => {
                                event.preventDefault()
                                go(href)
                              }}
                            >
                              {crumb.label}
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </Fragment>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>
              <WindowControls />
            </div>
          </header>
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <AppSidebar
            tree={tree}
            route={route}
            bookmarks={bookmarks}
            onGo={go}
            onOpenSplit={openSplit}
            canCreate={desktop}
            canCreateAtRoot={canCreateAtRoot}
            roots={roots}
            githubLabels={content.githubLabels}
            onCreate={(next: CreateState) => {
              if (!confirmLeave()) return
              if (isGithubVirtualPath(next.parent, content.githubLabels)) return
              setCreateState({
                ...next,
                parent: next.parent || defaultLabel,
              })
            }}
            onDelete={
              desktop
                ? (target: DeleteTarget) => {
                    const targetPath = target.kind === 'folder' ? target.path : target.file
                    if (isGithubVirtualPath(targetPath, content.githubLabels)) return
                    requestDelete(target)
                  }
                : undefined
            }
            onRename={
              desktop
                ? (target: RenameTarget) => {
                    const targetPath = target.kind === 'folder' ? target.path : target.file
                    if (isGithubVirtualPath(targetPath, content.githubLabels)) return
                    requestRename(target)
                  }
                : undefined
            }
            onRemoveRoot={desktop ? removeNotesFolder : undefined}
            onOpenSettings={() => {
              if (!confirmLeave()) return
              setSettingsOpen(true)
            }}
            onOpenBookmarks={() => {
              if (!confirmLeave()) return
              setBookmarksOpen(true)
            }}
          />
          <SidebarInset className="min-h-0 overflow-hidden">
            <div ref={splitRowRef} className="flex min-h-0 flex-1">
              <div
                ref={contentRef}
                className={`relative min-h-0 min-w-0 ${
                  showSplit ? 'w-full flex-1 md:w-(--split-main) md:flex-none' : 'flex-1'
                } ${showingGraph ? 'overflow-hidden' : 'overflow-auto'}`}
                style={
                  showSplit
                    ? ({ '--split-main': formatSplitWidth(splitWidth) } as CSSProperties)
                    : undefined
                }
              >
                {showingGraph ? (
                  <GlobalGraph pages={content.pages} onGo={go} />
                ) : loading ? (
                  <div className={PAGE_SHELL}>
                    <p className="text-sm text-muted-foreground">Loading notes…</p>
                  </div>
                ) : loadError ? (
                  <div className={PAGE_SHELL}>
                    <p className="text-sm text-destructive">{loadError}</p>
                    <p className="text-sm text-muted-foreground">
                      Open Settings and point the app at a smaller folder of notes.
                    </p>
                  </div>
                ) : !page ? (
                  <Dashboard
                    last={last}
                    onOpen={go}
                    tree={tree}
                    nodes={overviewNodes(tree, route)}
                    pages={content.pages}
                    topicCount={folderOverview ? countTopicPages(folderOverview) : content.topicCount}
                    folder={folderOverview}
                    githubLabels={content.githubLabels}
                  />
                ) : (
                  <Article
                    page={page}
                    files={previewFiles}
                    folder={page.isIndex ? dirForIndex(tree, page) : null}
                    section={section}
                    prev={prev}
                    next={next}
                    onGo={go}
                    onOpenSplit={openSplit}
                    desktop={desktop}
                    notesRoots={roots}
                    editing={editing}
                    readonly={Boolean(page.readonly)}
                    draft={draft}
                    dirty={dirty}
                    saving={saving}
                    onDraftChange={(value: string) => {
                      setDraft(value)
                      setDirty(value !== (page.raw || ''))
                    }}
                    onEdit={startEditing}
                    onCancel={cancelEditing}
                    editorRef={editorRef}
                    onSave={saveDraft}
                    onDelete={
                      desktop && !page.readonly
                        ? () => {
                            if (page.isIndex) {
                              const currentFolder = dirForIndex(tree, page)
                              requestDelete({
                                kind: 'folder',
                                name: currentFolder?.label || page.title,
                                path: currentFolder?.path || page.route,
                                expectedNames: [currentFolder?.label || page.title],
                              })
                              return
                            }
                            requestDelete({
                              kind: 'note',
                              name: page.navLabel || page.title,
                              file: page.file,
                            })
                          }
                        : undefined
                    }
                    bookmarked={!page.isIndex && bookmarks.includes(page.file)}
                    onToggleBookmark={
                      page.isIndex ? undefined : () => toggleBookmarked(page.file)
                    }
                    onToggleTask={
                      desktop && !page.readonly ? (index: number) => toggleTask(index) : undefined
                    }
                    onRename={
                      desktop &&
                      !page.readonly &&
                      !(
                        page.isIndex &&
                        attachedRootForDir(roots, dirForIndex(tree, page)?.path || page.route)
                      )
                        ? () => {
                            if (page.isIndex) {
                              const currentFolder = dirForIndex(tree, page)
                              requestRename({
                                kind: 'folder',
                                name: currentFolder?.label || page.title,
                                path: currentFolder?.path || page.route,
                              })
                              return
                            }
                            requestRename({
                              kind: 'note',
                              name: page.navLabel || page.title,
                              file: page.file,
                            })
                          }
                        : undefined
                    }
                  />
                )}
              </div>
              {showSplit ? (
                <>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize split view"
                    className="hidden w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/40 md:block"
                    onPointerDown={startSplitDrag}
                  />
                  <div className="hidden min-h-0 min-w-0 flex-1 md:flex">
                    <SplitPane
                      page={splitPage}
                      route={split}
                      files={previewFiles}
                      onGo={go}
                      onOpenSplit={openSplit}
                      onSwap={swapPanes}
                      onClose={closeSplit}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </SidebarInset>
          </div>
          <SearchCommand
            open={searchOpen}
            onOpenChange={setSearchOpen}
            onGo={go}
            tree={tree}
            listenShortcut={!desktop}
          />
          <BookmarksDialog
            open={bookmarksOpen}
            onOpenChange={setBookmarksOpen}
            entries={bookmarkEntries(bookmarks, content.pages)}
            onOpen={go}
            onRemove={toggleBookmarked}
          />
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            githubError={githubError}
            onSaved={async () => {
              setEditing(false)
              setDirty(false)
              await reloadNotes()
            }}
          />
          <CreateNoteDialog
            open={Boolean(createState)}
            onOpenChange={(open: boolean) => {
              if (!open) setCreateState(null)
            }}
            kind={createState?.kind}
            parent={createState?.parent || ''}
            rootParent={defaultLabel}
            onCreated={handleCreated}
          />
          <DeleteNoteDialog
            open={Boolean(deleteTarget)}
            onOpenChange={(open: boolean) => {
              if (!open) setDeleteTarget(null)
            }}
            target={deleteTarget}
            onDeleted={handleDeleted}
          />
          <RenameNoteDialog
            open={Boolean(renameTarget)}
            onOpenChange={(open: boolean) => {
              if (!open) setRenameTarget(null)
            }}
            target={renameTarget}
            onRenamed={handleRenamed}
          />
        </SidebarProvider>
        </TooltipProvider>
      </HighlightProvider>
      </AppearanceProvider>
    </ThemeProvider>
  )
}

function Dashboard({
  last,
  onOpen,
  tree,
  nodes,
  pages,
  topicCount,
  folder,
  githubLabels = [],
}: {
  last: string | null
  onOpen: (route: string) => void
  tree: NavNode[]
  nodes: NavNode[]
  pages: Pages
  topicCount: number
  folder: NavDirNode | null
  githubLabels?: string[]
}) {
  const lastPage = !folder && last ? pageByRoute(pages, last) : null
  const lastSection = !folder && last ? sectionForRoute(tree, last) : null
  const isGithubRepo = Boolean(folder && githubLabels.includes(folder.path))

  return (
    <div className={PAGE_SHELL}>
      <header className="grid gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {folder ? (isGithubRepo ? 'Repo' : 'Folder') : 'Keep the markdown. Read and write it here.'}
        </p>
        <h1 className="flex items-center gap-3 font-heading text-3xl font-medium tracking-tight">
          {folder ? folder.label : 'Notes stay files. This is the desk.'}
          {isGithubRepo ? <GithubMark className="size-6 shrink-0 text-muted-foreground" /> : null}
        </h1>
        <p className="max-w-xl text-muted-foreground">
          {folder
            ? folder.focus ||
              (isGithubRepo ? 'Folders and files in this repository.' : 'Folders and files in this directory.')
            : 'Notes stay on disk. Folders are menu groups. Use the sidebar or Settings to add files and point at a folder.'}
        </p>
        {last && lastPage && (
          <div className="min-w-0">
            <Button className="max-w-full min-w-0" onClick={() => onOpen(last)}>
              <span className="truncate">
                Continue {lastSection?.label ? `${lastSection.label} · ` : ''}
                {lastPage.title}
              </span>
            </Button>
          </div>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {nodes.map((node) => {
          const href = hrefForNode(node)
          const isDir = node.type === 'dir'
          const preview = isDir ? node.focus : node.page.blurb
          const count = isDir ? countTopicPages(node) : 0
          const isGithubRoot = isDir && githubLabels.includes(node.path)

          return (
            <Card key={node.id} className="h-full p-0">
              <button
                type="button"
                className="flex h-full w-full flex-col text-left transition-colors hover:bg-muted/40"
                onClick={() => href && onOpen(href)}
              >
                <CardHeader className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid min-w-0 flex-1 gap-1">
                      <CardTitle className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 line-clamp-2">{node.label}</span>
                        {isGithubRoot ? (
                          <GithubMark className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : null}
                      </CardTitle>
                      {preview ? (
                        <CardDescription className="line-clamp-2">{preview}</CardDescription>
                      ) : null}
                    </div>
                    {isDir ? (
                      <Folder aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
                <CardFooter className="mt-auto px-5 py-3 text-xs text-muted-foreground">
                  {isDir ? (
                    <>
                      {count} {count === 1 ? 'file' : 'files'}
                    </>
                  ) : (
                    <>{fileKindLabel(node.page.file)}</>
                  )}
                </CardFooter>
              </button>
            </Card>
          )
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        {topicCount} topic {topicCount === 1 ? 'file' : 'files'}
        {folder ? ' in this folder.' : ' on disk.'}
      </p>
    </div>
  )
}

function fileKindLabel(file: string): string {
  if (/\.txt$/i.test(file)) return 'Text'
  if (/\.html$/i.test(file)) return 'HTML'
  if (/\.css$/i.test(file)) return 'CSS'
  if (/\.js$/i.test(file)) return 'JavaScript'
  if (/\.md$/i.test(file)) return 'Markdown'
  return 'File'
}

function CuePanel({ cues }: { cues: string[] }) {
  if (!cues?.length) return null
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>On this topic</CardTitle>
        <CardDescription>Key points on this file.</CardDescription>
      </CardHeader>
      <ul className="grid gap-2 px-4 pb-4">
        {cues.map((cue) => (
          <li
            key={cue}
            className="border-l-2 border-primary/40 pl-3 text-sm leading-snug"
          >
            {cue}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Article({
  page,
  files,
  folder,
  section,
  prev,
  next,
  onGo,
  onOpenSplit,
  desktop,
  notesRoots = [],
  editing,
  readonly = false,
  draft,
  dirty,
  saving,
  onDraftChange,
  onEdit,
  onCancel,
  editorRef,
  onSave,
  onDelete,
  onRename,
  onToggleTask,
  bookmarked = false,
  onToggleBookmark,
}: {
  page: NotePage
  files: Record<string, string>
  folder: NavDirNode | null
  section: { id: string; label: string; path: string } | null
  prev: NotePage | null
  next: NotePage | null
  onGo: (route: string) => void
  onOpenSplit?: (route: string) => void
  desktop: boolean
  notesRoots?: string[]
  editing: boolean
  readonly?: boolean
  draft: string
  dirty: boolean
  saving: boolean
  onDraftChange: (value: string) => void
  onEdit: () => void
  onCancel: () => void
  editorRef: RefObject<NoteEditorHandle | CodeEditorHandle | PlainTextHandle | null>
  onSave: () => void
  onDelete?: () => void
  onRename?: () => void
  onToggleTask?: (index: number) => void
  bookmarked?: boolean
  onToggleBookmark?: () => void
}) {
  const kind = fileKind(page.file)
  const markdown = kind === 'markdown'
  const htmlPreviewRef = useRef<HtmlPreviewHandle>(null)
  const previewStageRef = useRef<HTMLDivElement>(null)
  const [htmlFullscreen, setHtmlFullscreen] = useState(false)
  const viewFindRef = useRef<CodeEditorHandle | PlainTextHandle | null>(null)
  const viewRootRef = useRef<HTMLDivElement>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findFocus, setFindFocus] = useState(0)
  const [findResult, setFindResult] = useState<FindResult>({ count: 0, index: -1 })
  const findQueryRef = useRef(findQuery)
  const findResultRef = useRef(findResult)
  const findInputRef = useRef<HTMLInputElement>(null)
  const findRevealedRef = useRef(false)
  findQueryRef.current = findQuery
  findResultRef.current = findResult

  useEffect(() => {
    setHtmlFullscreen(false)
  }, [page.file, editing])

  useEffect(() => {
    function onChange() {
      if (!document.fullscreenElement) setHtmlFullscreen(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    const el = previewStageRef.current
    // On a phone the app already fills the screen, and the native fullscreen
    // path draws to the raw display, where the safe-area insets that keep the
    // preview clear of the status bar resolve to zero. The `fixed inset-0`
    // overlay alone looks the same and keeps normal layout.
    if (isMobilePlatform(window.desktop?.platform)) return
    if (htmlFullscreen) {
      if (el && document.fullscreenElement !== el) void el.requestFullscreen?.().catch(() => {})
      return
    }
    if (document.fullscreenElement === el) void document.exitFullscreen?.().catch(() => {})
  }, [htmlFullscreen])

  async function openHtmlInBrowser() {
    try {
      if (window.desktop?.openInBrowser && !readonly) {
        await window.desktop.openInBrowser(page.file)
        return
      }
      const html = rewriteHtmlPreview(page.file, page.raw, files)
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) URL.revokeObjectURL(url)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not open in the browser')
    }
  }

  function restoreFindFocus(input: HTMLInputElement | null, start?: number | null, end?: number | null) {
    if (!input?.isConnected) return
    const apply = () => {
      if (!input.isConnected) return
      input.focus({ preventScroll: true })
      if (start != null && end != null) input.setSelectionRange(start, end)
    }
    apply()
    requestAnimationFrame(apply)
  }

  function closeFind() {
    setFindOpen(false)
    findRevealedRef.current = false
    clearFindHighlight()
  }

  async function performFind(query: string, index: number, reveal = true) {
    const input = findInputRef.current
    const caretStart = input?.selectionStart
    const caretEnd = input?.selectionEnd
    try {
      if (!editing && kind === 'html') {
        const result = await htmlPreviewRef.current?.search(query, index, { reveal, focus: false })
        setFindResult(result || { count: 0, index: -1 })
        if (reveal) findRevealedRef.current = true
        return
      }
      const handle = editing ? editorRef.current : viewFindRef.current
      const text = handle?.findText() || (viewRootRef.current ? collectText(viewRootRef.current) : '')
      const { matches, count, index: active } = runFind(text, query, index)
      if (!count || active < 0) clearFindHighlight()
      if (reveal && active >= 0 && matches[active]) {
        if (handle) handle.revealMatch(matches[active], { focus: false })
        else if (viewRootRef.current) revealInElement(viewRootRef.current, matches[active], { focus: false })
        findRevealedRef.current = true
      }
      setFindResult({ count, index: active })
    } finally {
      if (reveal) restoreFindFocus(input, caretStart, caretEnd)
    }
  }

  function stepFind(direction: 1 | -1) {
    const index = stepFindIndex(findResultRef.current.index, direction, findRevealedRef.current)
    void performFind(findQueryRef.current, index, true)
  }

  useEffect(() => {
    if (!findOpen) return
    findRevealedRef.current = false
    void performFind(findQuery, 0, false)
  }, [findOpen, findQuery, page.file, editing, kind])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof Element && event.target.closest('[role="dialog"]')) return
      if (isFindShortcut(event)) {
        event.preventDefault()
        event.stopPropagation()
        setFindOpen(true)
        setFindFocus((token) => token + 1)
        return
      }
      if (htmlFullscreen && event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setHtmlFullscreen(false)
        return
      }
      if (
        isHtmlFullscreenShortcut(event) &&
        !editing &&
        kind === 'html' &&
        !htmlFullscreen &&
        !findOpen
      ) {
        if (event.target instanceof HTMLElement && (event.target.matches('input, textarea') || event.target.isContentEditable)) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        setHtmlFullscreen(true)
        return
      }
      if (!findOpen) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeFind()
        return
      }
      if (isFindNextShortcut(event)) {
        event.preventDefault()
        stepFind(1)
        return
      }
      if (isFindPrevShortcut(event)) {
        event.preventDefault()
        stepFind(-1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [findOpen, htmlFullscreen, page.file, editing, kind])

  return (
    <article className={PAGE_SHELL}>
      {findOpen ? (
        <FindBar
          query={findQuery}
          result={findResult}
          focusToken={findFocus}
          inputRef={findInputRef}
          onQueryChange={setFindQuery}
          onNext={() => stepFind(1)}
          onPrev={() => stepFind(-1)}
          onClose={closeFind}
        />
      ) : null}
      <header className="grid gap-2">
        <div className="flex items-center gap-2">
          {onToggleBookmark ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
                  aria-pressed={bookmarked}
                  onClick={onToggleBookmark}
                  className="-ml-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Bookmark className={bookmarked ? 'fill-current text-foreground' : undefined} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{bookmarked ? 'Bookmarked' : 'Bookmark'}</TooltipContent>
            </Tooltip>
          ) : null}
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section?.label || 'Notes'}
          </p>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-3xl font-medium tracking-tight">
            {onRename ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onRename}
                    className="text-left underline-offset-4 hover:underline"
                    aria-label={`Rename ${page.title}`}
                  >
                    {page.title}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Rename</TooltipContent>
              </Tooltip>
            ) : (
              page.title
            )}
            {dirty ? <span className="ml-2 text-base text-muted-foreground">edited</span> : null}
          </h1>
          <div className="flex flex-wrap gap-2">
            {desktop && editing && (
              <>
                <Button variant="outline" size="sm" onClick={onCancel}>
                  <X />
                  Cancel
                  <Kbd>Esc</Kbd>
                </Button>
                <Button size="sm" onClick={onSave} disabled={saving || !dirty}>
                  <Save />
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            )}
            {desktop && !editing && !readonly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Pencil />
                    Edit
                    <Kbd>E</Kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit this note</TooltipContent>
              </Tooltip>
            )}
            {!editing && kind === 'html' && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHtmlFullscreen(true)}
                      aria-pressed={htmlFullscreen}
                    >
                      <Maximize2 />
                      Fullscreen
                      <Kbd>F</Kbd>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View this page fullscreen</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => void openHtmlInBrowser()}>
                      <Globe />
                      Open in browser
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open this HTML file in your browser</TooltipContent>
                </Tooltip>
              </>
            )}
            {onDelete && !editing && (
              <Button variant="outline" size="sm" onClick={onDelete}>
                <Trash2 />
                Delete
              </Button>
            )}
            {!readonly && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={noteEditorHref(page.file, notesRoots.length ? { notesRoots } : {})}
                  onClick={(event) => openNoteFile(event, page.file)}
                  aria-label={`Open ${noteRelPath(page.file)} in editor`}
                >
                  <SquareArrowOutUpRight />
                  Open file
                </a>
              </Button>
            )}
          </div>
        </div>
        {readonly ? (
          <p className="w-fit font-mono text-sm text-muted-foreground">{noteRelPath(page.file)}</p>
        ) : (
          <a
            href={noteEditorHref(page.file, notesRoots.length ? { notesRoots } : {})}
            onClick={(event) => openNoteFile(event, page.file)}
            className="w-fit font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Open ${noteRelPath(page.file)} in editor`}
          >
            {noteRelPath(page.file)}
          </a>
        )}
        {readonly && !editing && (
          <p className="text-sm text-muted-foreground">This file is from GitHub and is read-only.</p>
        )}
        {!editing && markdown && (
          <p className="text-sm text-muted-foreground">
            Select a phrase, then right-click to highlight it or attach a note.
          </p>
        )}
      </header>

      {!editing && markdown && <CuePanel cues={page.cue} />}

      {editing ? (
        kind === 'markdown' ? (
          <NoteEditor
            key={page.file}
            ref={editorRef}
            value={draft}
            onChange={onDraftChange}
          />
        ) : kind === 'text' ? (
          <PlainText
            key={page.file}
            ref={editorRef}
            value={draft}
            onChange={onDraftChange}
          />
        ) : (
          <CodeEditor
            key={page.file}
            ref={editorRef}
            kind={kind}
            value={draft}
            onChange={onDraftChange}
          />
        )
      ) : kind === 'html' ? (
        <div
          ref={previewStageRef}
          className={
            htmlFullscreen ? 'html-fullscreen fixed inset-0 z-50 flex flex-col bg-background' : undefined
          }
        >
          {htmlFullscreen ? (
            <div className="html-fullscreen-exit absolute top-3 right-3 z-10">
              <Button variant="outline" size="sm" onClick={() => setHtmlFullscreen(false)}>
                <Minimize2 />
                Exit fullscreen
                <Kbd>Esc</Kbd>
              </Button>
            </div>
          ) : null}
          <div className={htmlFullscreen ? 'min-h-0 flex-1' : undefined}>
            <HtmlPreview
              ref={htmlPreviewRef}
              file={page.file}
              html={page.raw}
              files={files}
              title={page.title}
              fill={htmlFullscreen}
            />
          </div>
        </div>
      ) : kind === 'css' || kind === 'js' ? (
        <CodeEditor key={page.file} ref={viewFindRef} kind={kind} value={page.raw} readOnly />
      ) : (
        <div ref={viewRootRef} className="typeset typeset-docs w-full">
          {kind === 'text' ? (
            <PlainText key={page.file} ref={viewFindRef} value={page.body} readOnly />
          ) : (
            <MarkdownView
              key={page.file}
              page={page}
              onNavigate={onGo}
              onOpenSplit={onOpenSplit}
              onToggleTask={onToggleTask}
            />
          )}
        </div>
      )}

      {!editing && page.isIndex && (
        <FolderFileAccordion folder={folder} onGo={onGo} />
      )}

      {!editing && (
        <>
          <Separator />
          <nav className="grid grid-cols-2 gap-3" aria-label="Adjacent topics">
            {prev ? (
              <Button variant="outline" className="h-auto justify-start py-3 whitespace-normal" onClick={() => onGo(prev.route)}>
                <ChevronLeft />
                <span className="grid min-w-0 text-left">
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Previous</span>
                  <span className="truncate">{prev.navLabel || prev.title}</span>
                </span>
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button variant="outline" className="h-auto justify-end py-3 whitespace-normal" onClick={() => onGo(next.route)}>
                <span className="grid min-w-0 text-right">
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Next</span>
                  <span className="truncate">{next.navLabel || next.title}</span>
                </span>
                <ChevronRight />
              </Button>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </article>
  )
}
