import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FolderOpen, Monitor, Moon, Search, SlidersHorizontal, Sun, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { isDesktop } from '@/lib/desktop'
import { HIGHLIGHT_COLORS } from '@/lib/highlight.ts'
import { useHighlight } from '@/lib/highlight-provider.tsx'
import { useTheme, type Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

type SectionId = 'general' | 'library'

const SECTIONS: {
  id: SectionId
  label: string
  icon: typeof SlidersHorizontal
  keywords: string[]
}[] = [
  {
    id: 'general',
    label: 'General',
    icon: SlidersHorizontal,
    keywords: ['appearance', 'theme', 'highlight', 'color', 'dark', 'light', 'system'],
  },
  {
    id: 'library',
    label: 'Library',
    icon: FolderOpen,
    keywords: ['folder', 'notes', 'path', 'root', 'markdown', 'files'],
  },
]

const APPEARANCE: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

function matchesQuery(section: (typeof SECTIONS)[number], query: string) {
  const haystack = [section.label, ...section.keywords].join(' ').toLowerCase()
  return haystack.includes(query)
}

export function SettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (roots: string[]) => void | Promise<void>
}) {
  const desktop = isDesktop()
  const [section, setSection] = useState<SectionId>('general')
  const [query, setQuery] = useState('')
  const [roots, setRoots] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SECTIONS
    return SECTIONS.filter((item) => matchesQuery(item, q))
  }, [query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSection('general')
      setError('')
      return
    }
    if (!window.desktop?.getNotesRoots) return
    window.desktop.getNotesRoots().then(setRoots).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not load settings')
    })
  }, [open])

  useEffect(() => {
    if (filtered.some((item) => item.id === section)) return
    if (filtered[0]) setSection(filtered[0].id)
  }, [filtered, section])

  async function persist(next: string[]) {
    if (!window.desktop?.setNotesRoots) return
    setBusy(true)
    setError('')
    try {
      const saved = await window.desktop.setNotesRoots(next)
      const effective = window.desktop.getNotesRoots
        ? await window.desktop.getNotesRoots()
        : saved
      setRoots(effective)
      onSaved?.(effective)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save those folders')
    } finally {
      setBusy(false)
    }
  }

  async function addFolder() {
    if (!window.desktop?.pickNotesFolder) return
    const picked = await window.desktop.pickNotesFolder()
    if (!picked) return
    if (roots.some((root) => root === picked)) return
    await persist([...roots, picked])
  }

  async function removeFolder(dir: string) {
    await persist(roots.filter((root) => root !== dir))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(36rem,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Appearance, highlight color, and notes folders.
        </DialogDescription>
        <div className="flex h-full min-h-0 flex-1 max-sm:flex-col">
          <aside className="flex w-full shrink-0 flex-col gap-3 border-b bg-muted/40 p-3 sm:w-52 sm:border-r sm:border-b-0">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="h-8 bg-background/80 pl-8"
                aria-label="Search settings"
              />
            </div>
            <div className="grid gap-1">
              <p className="px-2 text-xs font-medium text-muted-foreground">Settings</p>
              <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
                {filtered.length ? (
                  filtered.map((item) => {
                    const Icon = item.icon
                    const active = section === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setSection(item.id)}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                          active
                            ? 'bg-background text-foreground shadow-sm ring-1 ring-foreground/10'
                            : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                        )}
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </button>
                    )
                  })
                ) : (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No matching settings</p>
                )}
              </nav>
            </div>
          </aside>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="grid gap-8 p-6 pr-12">
              {section === 'general' && <GeneralPane />}
              {section === 'library' && (
                <LibraryPane
                  desktop={desktop}
                  roots={roots}
                  busy={busy}
                  error={error}
                  onAdd={addFolder}
                  onRemove={removeFolder}
                />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GeneralPane() {
  const { theme, setTheme } = useTheme()
  const { highlight, setHighlight } = useHighlight()

  return (
    <section className="grid gap-8">
      <header className="grid gap-1">
        <h2 className="font-heading text-base font-medium">Preferences</h2>
        <p className="text-sm text-muted-foreground">
          How the reader looks, and the color used when you mark a passage.
        </p>
      </header>

      <div className="grid gap-1">
        <PreferenceRow label="Appearance">
          <div
            role="radiogroup"
            aria-label="Appearance"
            className="inline-flex rounded-lg border bg-muted/60 p-0.5"
          >
            {APPEARANCE.map((option) => {
              const Icon = option.icon
              const selected = theme === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    selected && 'bg-background text-foreground shadow-sm',
                  )}
                >
                  <Icon className="size-4" />
                </button>
              )
            })}
          </div>
        </PreferenceRow>

        <PreferenceRow label="Highlight color">
          <div role="radiogroup" aria-label="Highlight color" className="flex flex-wrap gap-1.5">
            {HIGHLIGHT_COLORS.map((color) => {
              const selected = highlight === color.id
              return (
                <button
                  key={color.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={color.label}
                  title={color.label}
                  onClick={() => setHighlight(color.id)}
                  className={cn(
                    'size-7 rounded-full outline-none ring-2 ring-offset-2 ring-offset-background transition-shadow focus-visible:ring-ring',
                    selected ? 'ring-foreground' : 'ring-transparent hover:ring-foreground/30',
                  )}
                  style={{ background: color.value }}
                />
              )
            })}
          </div>
        </PreferenceRow>
      </div>

      <p className="rounded-lg border bg-muted/30 px-3 py-3 text-sm leading-relaxed">
        Select a phrase and it will look like{' '}
        <span className="ann-mark">this on the page</span>.
      </p>
    </section>
  )
}

function PreferenceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  )
}

function LibraryPane({
  desktop,
  roots,
  busy,
  error,
  onAdd,
  onRemove,
}: {
  desktop: boolean
  roots: string[]
  busy: boolean
  error: string
  onAdd: () => void
  onRemove: (dir: string) => void
}) {
  return (
    <section className="grid gap-4">
      <header className="grid gap-1">
        <h2 className="font-heading text-base font-medium">Notes folders</h2>
        <p className="text-sm text-muted-foreground">
          Attach one or more folders of `.md` and `.txt` files. With more than one folder, each
          becomes a top-level group in the sidebar.
        </p>
      </header>

      {!desktop ? (
        <p className="rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
          Folder attachments are available in the desktop app.
        </p>
      ) : (
        <div className="grid gap-2">
          {roots.length ? (
            <ul className="grid gap-2">
              {roots.map((root) => (
                <li
                  key={root}
                  className="flex items-center gap-2 rounded-lg border bg-muted/20 px-2.5 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs" title={root}>
                    {root}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${root}`}
                    disabled={busy}
                    onClick={() => onRemove(root)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No folders yet.</p>
          )}
          <Button type="button" variant="outline" className="justify-self-start" disabled={busy} onClick={onAdd}>
            Add folder
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
