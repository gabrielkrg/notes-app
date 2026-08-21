import { useEffect, useState } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { isDesktop } from '@/lib/desktop'
import { needsCustomWindowButtons } from '@/lib/title-bar.ts'

function overlayVisible() {
  const overlay = window.navigator.windowControlsOverlay
  return Boolean(overlay?.visible)
}

export function WindowControls() {
  const desktop = isDesktop()
  const [maximized, setMaximized] = useState(false)
  const [overlay, setOverlay] = useState(overlayVisible)

  useEffect(() => {
    if (!desktop) return
    const wco = window.navigator.windowControlsOverlay
    if (!wco) return
    const sync = () => setOverlay(wco.visible)
    sync()
    wco.addEventListener('geometrychange', sync)
    return () => wco.removeEventListener('geometrychange', sync)
  }, [desktop])

  useEffect(() => {
    const api = window.desktop
    if (!api) return
    void api.isMaximized().then(setMaximized)
    return api.onMaximizeChange(setMaximized)
  }, [])

  if (!desktop || !needsCustomWindowButtons(window.desktop?.platform, overlay)) {
    return null
  }

  return (
    <div className="titlebar-controls flex shrink-0 items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Minimize"
        onClick={() => void window.desktop?.minimizeWindow()}
      >
        <Minus />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={() => void window.desktop?.toggleMaximizeWindow()}
      >
        {maximized ? <Copy /> : <Square />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close"
        className="hover:bg-destructive hover:text-white dark:hover:bg-destructive dark:hover:text-white"
        onClick={() => void window.desktop?.closeWindow()}
      >
        <X />
      </Button>
    </div>
  )
}
