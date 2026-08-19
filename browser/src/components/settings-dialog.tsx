import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function SettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (roots: string[]) => void | Promise<void>
}) {
  const [roots, setRoots] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !window.desktop?.getNotesRoots) return
    setError('')
    window.desktop.getNotesRoots().then(setRoots).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not load settings')
    })
  }, [open])

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
      <DialogContent className="sm:max-w-lg">
        <div className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Attach one or more folders of `.md` and `.txt` files. With more than one folder, each
              becomes a top-level group in the sidebar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">Notes folders</span>
            {roots.length ? (
              <ul className="grid gap-2">
                {roots.map((root) => (
                  <li key={root} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs" title={root}>
                      {root}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Remove ${root}`}
                      disabled={busy}
                      onClick={() => removeFolder(root)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No folders yet.</p>
            )}
            <Button type="button" variant="outline" disabled={busy} onClick={addFolder}>
              Add folder
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
