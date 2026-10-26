import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

const groups = [
  {
    title: 'Move around',
    shortcuts: [
      ['Ctrl + E', 'Switch focus between the sidebar menu and note content. Opens the sidebar if hidden.'],
      ['Ctrl + B', 'Show or hide the sidebar. In the visual editor, make text bold.'],
      ['↑ / ↓', 'Move through visible menu items while the sidebar has focus.'],
      ['→ / ←', 'Expand a folder or move to its children; collapse it or move to its parent.'],
      ['Home / End', 'Focus the first or last item in the sidebar.'],
      ['Enter / Space', 'Activate the focused button. Enter also opens a focused note link.'],
      ['Ctrl + Enter', 'Open a focused sidebar note or folder in the split pane.'],
      ['Esc', 'Return from the sidebar to note content, or close the current dialog.'],
      ['Alt + Home', 'Go to Dashboard.'],
      ['Ctrl + Shift + G', 'Switch between Graph and Dashboard.'],
      ['[ / ]', 'Open the previous or next note.'],
      ['Tab / Shift + Tab', 'Move forward or backward through buttons, links, and fields.'],
    ],
  },
  {
    title: 'Search and panels',
    shortcuts: [
      ['Ctrl + K', 'Open or close note search.'],
      ['/', 'Open search while reading.'],
      ['Ctrl + F', 'Open or close find in the current note.'],
      ['F3 / Shift + F3', 'Next or previous find match. Enter / Shift + Enter also work in the find field.'],
      ['Ctrl + ,', 'Open or close Settings.'],
      ['Ctrl + Shift + B', 'Open or close Bookmarks.'],
      ['Ctrl + D', 'Add or remove the current note bookmark.'],
      ['Ctrl + /', 'Open or close this shortcut guide. ? also opens it while reading.'],
      ['F5', 'Reload notes folders and sync remote notes.'],
    ],
  },
  {
    title: 'Write and preview',
    shortcuts: [
      ['Ctrl + N', 'Create a new note in the default folder (desktop).'],
      ['E', 'Start editing a writable note, or leave editing when focus is outside a text field.'],
      ['Ctrl + S', 'Save the current note.'],
      ['Esc', 'Cancel editing; asks before discarding unsaved changes.'],
      ['Ctrl + I / Ctrl + K', 'Italic / insert link in the visual editor.'],
      ['Ctrl + K, Ctrl + O', 'Attach a notes folder (desktop). Press Ctrl + O within half a second.'],
      ['F', 'Enter or leave HTML fullscreen while focus is outside the preview frame. Esc also leaves fullscreen.'],
    ],
  },
]

export function ShortcutsDialog({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-3rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-5 pr-12">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            On macOS, use ⌘ instead of Ctrl. Plain-letter shortcuts are paused while typing.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto p-5" tabIndex={0} aria-label="Shortcut descriptions">
          {groups.map((group) => (
            <section key={group.title} className="mb-6 last:mb-0">
              <h3 className="mb-2 font-heading font-medium">{group.title}</h3>
              <dl className="divide-y">
                {group.shortcuts.map(([keys, description]) => (
                  <div key={keys} className="grid grid-cols-[8.5rem_1fr] items-start gap-3 py-2.5 max-sm:grid-cols-1 max-sm:gap-1">
                    <dt><Kbd className="h-auto whitespace-normal px-1.5 py-0.5">{keys}</Kbd></dt>
                    <dd className="text-muted-foreground">{description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
