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
import { confirmFolderName, type DeleteTarget } from '@/lib/note-delete.ts'

export function DeleteNoteDialog({
  open,
  onOpenChange,
  target,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: DeleteTarget | null
  onDeleted?: (target: DeleteTarget) => void
}) {
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isFolder = target?.kind === 'folder'
  const expectedNames = target?.kind === 'folder'
    ? target.expectedNames || (target.name ? [target.name] : [])
    : target?.name
      ? [target.name]
      : []
  const canConfirm = isFolder ? confirmFolderName(typed, expectedNames) : Boolean(target)

  useEffect(() => {
    if (!open) return
    setTyped('')
    setError('')
    setBusy(false)
  }, [open, target?.kind === 'folder' ? target.path : target?.file])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!window.desktop || !target || !canConfirm) return
    setBusy(true)
    setError('')
    try {
      if (target.kind === 'folder') {
        await window.desktop.deleteFolder({
          path: target.path,
          confirmName: typed,
          expectedNames,
        })
      } else {
        await window.desktop.deleteNote(target.file)
      }
      onDeleted?.(target)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{isFolder ? 'Delete folder' : 'Delete note'}</DialogTitle>
            <DialogDescription>
              {isFolder
                ? `This deletes ${target?.name || 'this folder'} and everything inside it. Type the folder name to confirm.`
                : `This deletes ${target?.name || 'this note'}. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          {isFolder && (
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Type <span className="font-mono text-foreground">{target?.name}</span> to confirm
              </span>
              <Input
                autoFocus
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={target?.name || 'Folder name'}
              />
            </label>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy || !canConfirm}>
              {busy ? 'Deleting…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
