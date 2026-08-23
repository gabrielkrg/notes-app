import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import {
  applyFontSize,
  applyPalette,
  persistFontSize,
  persistPalette,
  readFontSize,
  readPalette,
  syncDesktopTitleBar,
  type FontSize,
  type Palette,
} from './appearance.ts'

const AppearanceContext = createContext<{
  fontSize: FontSize
  palette: Palette
  setFontSize: (size: FontSize) => void
  setPalette: (palette: Palette) => void
}>({
  fontSize: 'medium',
  palette: 'ink',
  setFontSize: () => {},
  setPalette: () => {},
})

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const size = readFontSize()
    if (typeof document !== 'undefined') applyFontSize(size)
    return size
  })
  const [palette, setPaletteState] = useState<Palette>(() => {
    const next = readPalette()
    if (typeof document !== 'undefined') applyPalette(next)
    return next
  })

  useEffect(() => {
    applyFontSize(fontSize)
    persistFontSize(fontSize)
  }, [fontSize])

  useEffect(() => {
    applyPalette(palette)
    persistPalette(palette)
    syncDesktopTitleBar()
  }, [palette])

  return (
    <AppearanceContext.Provider
      value={{
        fontSize,
        palette,
        setFontSize: setFontSizeState,
        setPalette: setPaletteState,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  return useContext(AppearanceContext)
}
