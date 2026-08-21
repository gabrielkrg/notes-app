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
import type { RenameTarget } from '@/lib/note-rename.ts'

export function RenameNoteDialog({
  open,
  onOpenChange,
  target,
  onRenamed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: RenameTarget | null
  onRenamed?: (target: RenameTarget, result: { file?: string; path?: string }) => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isFolder = target?.kind === 'folder'

  useEffect(() => {
    if (!open) return
    setName(target?.name || '')
    setError('')
    setBusy(false)
  }, [open, target])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!window.desktop || !target || !name.trim()) return
    setBusy(true)
    setError('')
    try {
      const result =
        target.kind === 'folder'
          ? await window.desktop.renameFolder({ path: target.path, name })
          : await window.desktop.renameNote({ file: target.file, name })
      onRenamed?.(target, result)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename that')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{isFolder ? 'Rename folder' : 'Rename note'}</DialogTitle>
            <DialogDescription>
              {isFolder
                ? 'Renames this folder on disk. Notes inside it keep their names.'
                : 'Renames the file. Markdown notes also update the title inside the note.'}
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Renaming…' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
