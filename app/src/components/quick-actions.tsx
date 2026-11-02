import type { ReactNode } from 'react'
import { Keyboard, RefreshCw, Settings } from '@/components/icons'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ShortcutHint } from '@/components/search-command'

function DockButton({ label, hint, shortcut, disabled, onClick, children }: {
  label: string
  hint: ReactNode
  shortcut?: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} aria-keyshortcuts={shortcut} disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {label}
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}

/** Floating utility dock: actions used occasionally, kept out of the toolbar and menu. */
export function QuickActions({ refreshing, onReload, onOpenShortcuts, onOpenSettings }: {
  refreshing: boolean
  onReload: () => void
  onOpenShortcuts: () => void
  onOpenSettings: () => void
}) {
  return (
    <div role="toolbar" aria-label="Quick actions" className="quick-actions">
      <DockButton label="Reload folders" hint={<Kbd>F5</Kbd>} shortcut="F5" disabled={refreshing} onClick={onReload}>
        <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
      </DockButton>
      <DockButton label="Keyboard shortcuts" hint={<Kbd>?</Kbd>} shortcut="?" onClick={onOpenShortcuts}>
        <Keyboard />
      </DockButton>
      <DockButton label="Settings" hint={<ShortcutHint keyLabel="," />} onClick={onOpenSettings}>
        <Settings />
      </DockButton>
    </div>
  )
}
