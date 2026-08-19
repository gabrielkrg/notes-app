import { Fragment, useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FileText,
  Folder,
  Pencil,
  Save,
  Settings,
  SquareArrowOutUpRight,
  Trash2,
  X,
} from 'lucide-react'

import { AppSidebar } from '@/components/app-sidebar'
import { GlobalGraph } from '@/components/global-graph'
import { FolderFileAccordion } from '@/components/folder-file-accordion'
import { CreateNoteDialog } from '@/components/create-note-dialog'
import { DeleteNoteDialog } from '@/components/delete-note-dialog'
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
import { SearchCommand, SearchTrigger } from '@/components/search-command'
import { ThemeToggle } from '@/components/theme-toggle'
import { TooltipProvider } from '@/components/ui/tooltip'
import { HighlightProvider } from '@/lib/highlight-provider.tsx'
import { ThemeProvider } from '@/lib/theme'
import { noteEditorHref, storageKey } from '@/lib/config.ts'
import { isDesktop } from '@/lib/desktop'
import type { CreatedNote } from '@/lib/desktop.ts'
import { CtrlKChord } from '@/lib/key-chords'
import { labelNotesRoots } from '@/lib/notes-roots.ts'
import type { DeleteTarget } from '@/lib/note-delete.ts'
import type { NoteKind } from '@/lib/note-name.ts'
import MarkdownView from './MarkdownView.tsx'
import {
  buildContent,
  bundledContent,
  countTopicPages,
  crumbsForRoute,
  dirForIndex,
  dirForRoute,
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

const DONE_KEY = storageKey('done')
const LAST_KEY = storageKey('last')

function noteRelPath(file: string) {
  return file
}

function openNoteFile(event: MouseEvent<HTMLAnchorElement>, file: string) {
  if (window.desktop?.openNote) {
    event.preventDefault()
    window.desktop.openNote(file)
  }
}

function loadDone(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(DONE_KEY) || '[]') as unknown
    return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item)) : [])
  } catch {
    return new Set()
  }
}

function saveDone(set: Set<string>) {
  localStorage.setItem(DONE_KEY, JSON.stringify([...set]))
}

function emptyContent(): Content {
  return { pages: {}, navTree: [], topicPages: [], topicCount: 0 }
}

export default function App() {
  const desktop = isDesktop()
  const [content, setContent] = useState<Content>(() => (desktop ? emptyContent() : bundledContent))
  const [roots, setRoots] = useState<string[]>([])
  const [loading, setLoading] = useState(desktop)
  const [loadError, setLoadError] = useState('')
  const [route, setRoute] = useState(() => parseHash())
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createState, setCreateState] = useState<CreateState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<Set<string>>(loadDone)
  const contentRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<NoteEditorHandle | null>(null)
  const chordRef = useRef<CtrlKChord | null>(null)
  if (!chordRef.current) chordRef.current = new CtrlKChord()

  const tree = content.navTree
  const showingGraph = isGraphRoute(route)
  const page = showingGraph ? null : pageByRoute(content.pages, route)
  const folderOverview = !page && !showingGraph ? dirForRoute(tree, route) : null
  const showingDashboard = !page && !showingGraph && !folderOverview
  const section = sectionForRoute(tree, route)
  const crumbs = crumbsForRoute(tree, route)
  const { prev, next } = neighbors(tree, route)
  const last = localStorage.getItem(LAST_KEY)

  async function reloadNotes() {
    if (!window.desktop?.listNotes) {
      setContent(bundledContent)
      setLoading(false)
      return
    }
    setLoadError('')
    try {
      if (window.desktop.getNotesRoots) {
        setRoots(await window.desktop.getNotesRoots())
      }
      const files = await window.desktop.listNotes()
      setContent(buildContent(files))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not read notes')
      setContent(emptyContent())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!desktop) return
    reloadNotes()
  }, [desktop])

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (route && !isGraphRoute(route)) localStorage.setItem(LAST_KEY, route)
    contentRef.current?.scrollTo(0, 0)
  }, [route])

  useEffect(() => {
    if (!editing || dirty) return
    setDraft(page?.raw || '')
  }, [editing, dirty, page?.file, page?.raw])

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        if (!editing) return
        event.preventDefault()
        saveDraft()
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
      if (event.key === '/') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === '[' && prev) go(prev.route)
      if (event.key === ']' && next) go(next.route)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, editing, draft, page, desktop, searchOpen])

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

  function go(nextRoute: string) {
    if (!confirmLeave()) return
    setEditing(false)
    setDirty(false)
    setHash(nextRoute)
    setRoute(nextRoute)
  }

  function startEditing() {
    setDraft(page?.raw || '')
    setDirty(false)
    setEditing(true)
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
      setEditing(false)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not save the note')
    } finally {
      setSaving(false)
    }
  }

  function toggleDone(file: string) {
    setDone((current) => {
      const nextSet = new Set(current)
      if (nextSet.has(file)) nextSet.delete(file)
      else nextSet.add(file)
      saveDone(nextSet)
      return nextSet
    })
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
    const leave =
      roots.length <= 1 ||
      (removed && (route === removed.label || route.startsWith(`${removed.label}/`)))
    await window.desktop.setNotesRoots(roots.filter((root) => root !== dir))
    setEditing(false)
    setDirty(false)
    await reloadNotes()
    if (leave) {
      setHash('')
      setRoute('')
    }
  }

  async function handleCreated(created: CreatedNote) {
    await reloadNotes()
    const nextRoute = routeFor(created.file)
    setHash(nextRoute)
    setRoute(nextRoute)
    setDraft(created.raw)
    setDirty(false)
    setEditing(true)
  }

  function requestDelete(target: DeleteTarget) {
    if (!confirmLeave()) return
    setDeleteTarget(target)
  }

  async function handleDeleted(target: DeleteTarget) {
    const folderPath = target?.kind === 'folder' ? target.path : ''
    const deletedFile = target?.kind === 'note' ? target.file : ''
    const shouldLeave =
      (folderPath && (route === folderPath || route.startsWith(`${folderPath}/`))) ||
      (deletedFile && page?.file === deletedFile)

    setEditing(false)
    setDirty(false)
    await reloadNotes()
    if (shouldLeave) {
      setHash('')
      setRoute('')
    }
    setDeleteTarget(null)
  }

  const doneCount = content.topicPages.filter((item) => done.has(item.file)).length

  return (
    <ThemeProvider>
      <HighlightProvider>
        <TooltipProvider>
        <SidebarProvider className="h-svh overflow-hidden">
          <AppSidebar
            tree={tree}
            route={route}
            done={done}
            doneCount={doneCount}
            topicCount={content.topicCount}
            onGo={go}
            canCreate={desktop}
            canCreateAtRoot={desktop && roots.length <= 1}
            protectRootFolders={roots.length > 1}
            roots={roots}
            onCreate={(next: CreateState) => {
              if (!confirmLeave()) return
              setCreateState(next)
            }}
            onDelete={desktop ? requestDelete : undefined}
            onRemoveRoot={desktop ? removeNotesFolder : undefined}
          />
          <SidebarInset className="min-h-0 overflow-hidden">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
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
              <SearchTrigger
                onOpen={() => setSearchOpen(true)}
                className="w-36 shrink-0 sm:w-56"
              />
              {page && !page.isIndex && (
                <Button
                  variant={done.has(page.file) ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => toggleDone(page.file)}
                >
                  {done.has(page.file) ? <Check /> : <CircleDashed />}
                  {done.has(page.file) ? 'Read' : 'Mark as read'}
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                aria-label="Settings"
                onClick={() => {
                  if (!confirmLeave()) return
                  setSettingsOpen(true)
                }}
              >
                <Settings />
              </Button>
              <ThemeToggle />
            </header>

            <div className="flex min-h-0 flex-1">
              <div
                ref={contentRef}
                className={`relative min-h-0 min-w-0 flex-1 ${showingGraph ? 'overflow-hidden' : 'overflow-auto'}`}
              >
                {showingGraph ? (
                  <GlobalGraph pages={content.pages} onGo={go} />
                ) : loading ? (
                  <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-6 py-10">
                    <p className="text-sm text-muted-foreground">Reading notes from disk…</p>
                  </div>
                ) : loadError ? (
                  <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-6 py-10">
                    <p className="text-sm text-destructive">{loadError}</p>
                    <p className="text-sm text-muted-foreground">
                      Open Settings and point the app at a smaller folder of markdown files.
                    </p>
                  </div>
                ) : !page ? (
                  <Dashboard
                    last={last}
                    onOpen={go}
                    done={done}
                    tree={tree}
                    nodes={overviewNodes(tree, route)}
                    pages={content.pages}
                    topicCount={folderOverview ? countTopicPages(folderOverview) : content.topicCount}
                    folder={folderOverview}
                  />
                ) : (
                  <Article
                    page={page}
                    folder={page.isIndex ? dirForIndex(tree, page) : null}
                    section={section}
                    prev={prev}
                    next={next}
                    onGo={go}
                    desktop={desktop}
                    notesRoots={roots}
                    editing={editing}
                    draft={draft}
                    dirty={dirty}
                    saving={saving}
                    onDraftChange={(value: string) => {
                      setDraft(value)
                      setDirty(value !== (page.raw || ''))
                    }}
                    onEdit={startEditing}
                    onCancel={() => {
                      if (!confirmLeave()) return
                      setDraft(page.raw || '')
                      setDirty(false)
                      setEditing(false)
                    }}
                    editorRef={editorRef}
                    onSave={saveDraft}
                    onDelete={
                      desktop
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
                  />
                )}
              </div>
              {page && page.cue.length > 0 && !editing && (
                <aside className="hidden w-72 shrink-0 overflow-auto border-l xl:block">
                  <div className="sticky top-0 p-4">
                    <CuePanel cues={page.cue} />
                  </div>
                </aside>
              )}
            </div>
          </SidebarInset>
          <SearchCommand
            open={searchOpen}
            onOpenChange={setSearchOpen}
            onGo={go}
            tree={tree}
            listenShortcut={!desktop}
          />
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
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
        </SidebarProvider>
        </TooltipProvider>
      </HighlightProvider>
    </ThemeProvider>
  )
}

function Dashboard({
  last,
  onOpen,
  done,
  tree,
  nodes,
  pages,
  topicCount,
  folder,
}: {
  last: string | null
  onOpen: (route: string) => void
  done: Set<string>
  tree: NavNode[]
  nodes: NavNode[]
  pages: Pages
  topicCount: number
  folder: NavDirNode | null
}) {
  const lastPage = !folder && last ? pageByRoute(pages, last) : null
  const lastSection = !folder && last ? sectionForRoute(tree, last) : null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="grid gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {folder ? 'Folder' : 'Keep the markdown. Read and write it here.'}
        </p>
        <h1 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
          {folder ? folder.label : 'Notes stay files. This is the desk.'}
        </h1>
        <p className="max-w-xl text-muted-foreground">
          {folder
            ? folder.focus || 'Folders and files in this directory.'
            : 'Notes stay on disk. Folders are menu groups. Use the sidebar or Settings to add files and point at a folder.'}
        </p>
        {last && lastPage && (
          <div>
            <Button onClick={() => onOpen(last)}>
              Continue {lastSection?.label ? `${lastSection.label} · ` : ''}
              {lastPage.title}
            </Button>
          </div>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {nodes.map((node) => {
          if (node.type === 'page') {
            return (
              <Card key={node.id} className="h-full p-0">
                <button
                  type="button"
                  className="flex h-full w-full flex-col text-left transition-colors hover:bg-muted/40"
                  onClick={() => onOpen(node.page.route)}
                >
                  <CardHeader className="flex-1 p-5">
                    <div className="flex items-start gap-2.5">
                      <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="grid min-w-0 gap-1">
                        <CardTitle>{node.label}</CardTitle>
                        <CardDescription>{node.page.blurb}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </button>
              </Card>
            )
          }

          const count = countTopicPages(node)
          const marked = countMarked(node, done)
          const href = hrefForNode(node)
          return (
            <Card key={node.id} className="h-full p-0">
              <button
                type="button"
                className="flex h-full w-full flex-col text-left transition-colors hover:bg-muted/40"
                onClick={() => href && onOpen(href)}
              >
                <CardHeader className="flex-1 p-5">
                  <div className="flex items-start gap-2.5">
                    <Folder aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="grid min-w-0 gap-1">
                      <CardTitle>{node.label}</CardTitle>
                      <CardDescription>{node.focus}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardFooter className="mt-auto px-5 py-3 text-xs text-muted-foreground">
                  {count} {count === 1 ? 'file' : 'files'}
                  {marked > 0 ? ` · ${marked} read` : ''}
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

function countMarked(node: NavNode, done: Set<string>): number {
  if (node.type === 'page') return done.has(node.page.file) ? 1 : 0
  return (node.children || []).reduce((sum, child) => sum + countMarked(child, done), 0)
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
  folder,
  section,
  prev,
  next,
  onGo,
  desktop,
  notesRoots = [],
  editing,
  draft,
  dirty,
  saving,
  onDraftChange,
  onEdit,
  onCancel,
  editorRef,
  onSave,
  onDelete,
}: {
  page: NotePage
  folder: NavDirNode | null
  section: { id: string; label: string; path: string } | null
  prev: NotePage | null
  next: NotePage | null
  onGo: (route: string) => void
  desktop: boolean
  notesRoots?: string[]
  editing: boolean
  draft: string
  dirty: boolean
  saving: boolean
  onDraftChange: (value: string) => void
  onEdit: () => void
  onCancel: () => void
  editorRef: RefObject<NoteEditorHandle | null>
  onSave: () => void
  onDelete?: () => void
}) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="grid gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {section?.label || 'Notes'}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-3xl font-medium tracking-tight">
            {page.title}
            {dirty ? <span className="ml-2 text-base text-muted-foreground">edited</span> : null}
          </h1>
          <div className="flex flex-wrap gap-2">
            {desktop && editing && (
              <>
                <Button variant="outline" size="sm" onClick={onCancel}>
                  <X />
                  Cancel
                </Button>
                <Button size="sm" onClick={onSave} disabled={saving || !dirty}>
                  <Save />
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            )}
            {desktop && !editing && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil />
                Edit
              </Button>
            )}
            {onDelete && !editing && (
              <Button variant="outline" size="sm" onClick={onDelete}>
                <Trash2 />
                Delete
              </Button>
            )}
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
          </div>
        </div>
        <a
          href={noteEditorHref(page.file, notesRoots.length ? { notesRoots } : {})}
          onClick={(event) => openNoteFile(event, page.file)}
          className="w-fit font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Open ${noteRelPath(page.file)} in editor`}
        >
          {noteRelPath(page.file)}
        </a>
        {!editing && (
          <p className="text-sm text-muted-foreground">
            Select a phrase to highlight it or attach a note.
          </p>
        )}
      </header>

      {!editing && (
        <div className="xl:hidden">
          <CuePanel cues={page.cue} />
        </div>
      )}

      {editing ? (
        <NoteEditor
          key={page.file}
          ref={editorRef}
          value={draft}
          onChange={onDraftChange}
        />
      ) : (
        <div className="typeset typeset-docs max-w-[37em]">
          <MarkdownView key={page.file} page={page} onNavigate={onGo} />
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
