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
import type { NoteKind } from '@/lib/note-name.ts'

export function CreateNoteDialog({
  open,
  onOpenChange,
  kind = 'note',
  parent = '',
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind?: NoteKind
  parent?: string
  onCreated?: (created: CreatedNote) => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isFolder = kind === 'folder'

  useEffect(() => {
    if (!open) return
    setName('')
    setError('')
    setBusy(false)
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!window.desktop) return
    setBusy(true)
    setError('')
    try {
      const create = isFolder ? window.desktop.createFolder : window.desktop.createNote
      const created = await create({ parent, name })
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
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{isFolder ? 'New folder' : 'New note'}</DialogTitle>
            <DialogDescription>
              {isFolder
                ? 'Creates a folder with an index.md so it shows up in the sidebar.'
                : 'Creates a markdown file you can edit in the app.'}
            </DialogDescription>
          </DialogHeader>
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
            {parent ? `In ${parent}` : 'In the notes root'}
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
