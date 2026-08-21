import { useEffect, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { CreatedNote } from '@/lib/desktop.ts'
import type { NoteFileType, NoteKind } from '@/lib/note-name.ts'

const NOTE_TYPES: { id: NoteFileType; label: string }[] = [
  { id: 'markdown', label: 'Markdown' },
  { id: 'text', label: 'Text' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'js', label: 'JavaScript' },
]

function typeDescription(type: NoteFileType): string {
  if (type === 'text') return 'Creates a text file. The app shows the contents in the app font, without markdown formatting.'
  if (type === 'html') return 'Creates an HTML file. The app shows a live preview; desktop can edit the source.'
  if (type === 'css') return 'Creates a CSS file you can edit as highlighted source.'
  if (type === 'js') return 'Creates a JavaScript file you can edit as highlighted source.'
  return 'Creates a markdown file you can edit in the app.'
}

export function CreateNoteDialog({
  open,
  onOpenChange,
  kind = 'note',
  parent = '',
  rootParent = '',
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind?: NoteKind
  parent?: string
  rootParent?: string
  onCreated?: (created: CreatedNote) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<NoteFileType>('markdown')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isFolder = kind === 'folder'

  useEffect(() => {
    if (!open) return
    setName('')
    setType('markdown')
    setError('')
    setBusy(false)
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!window.desktop) return
    setBusy(true)
    setError('')
    try {
      const created = isFolder
        ? await window.desktop.createFolder({ parent, name })
        : await window.desktop.createNote({ parent, name, type })
      onCreated?.(created)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that note')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{isFolder ? 'New folder' : 'New note'}</DialogTitle>
            <DialogDescription>
              {isFolder
                ? 'Creates a folder with an index.md so it shows up in the sidebar.'
                : typeDescription(type)}
            </DialogDescription>
          </DialogHeader>
          {!isFolder && (
            <fieldset className="grid gap-1.5">
              <legend className="text-xs font-medium text-muted-foreground">Type</legend>
              <div className="flex flex-wrap gap-1 rounded-lg border p-0.5">
                {NOTE_TYPES.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={type === item.id ? 'secondary' : 'ghost'}
                    aria-pressed={type === item.id}
                    onClick={() => setType(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </fieldset>
          )}
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={isFolder ? 'Interview prep' : 'Time and space'}
            />
          </label>
          <p className="font-mono text-xs text-muted-foreground">
            {parent && parent !== rootParent ? `In ${parent}` : 'In the notes root'}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
