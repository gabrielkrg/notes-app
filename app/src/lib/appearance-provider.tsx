import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import {
  applyFontSize,
  applyPalette,
  applyTypeface,
  persistFontSize,
  persistPalette,
  persistTypeface,
  readFontSize,
  readPalette,
  readTypeface,
  syncDesktopTitleBar,
  typefaceForPalette,
  type FontSize,
  type Palette,
  type Typeface,
} from './appearance.ts'

const AppearanceContext = createContext<{
  fontSize: FontSize
  palette: Palette
  typeface: Typeface
  setFontSize: (size: FontSize) => void
  setPalette: (palette: Palette) => void
  setTypeface: (typeface: Typeface) => void
}>({
  fontSize: 'medium',
  palette: 'ink',
  typeface: 'grotesk-merriweather',
  setFontSize: () => {},
  setPalette: () => {},
  setTypeface: () => {},
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
  const [typeface, setTypefaceState] = useState<Typeface>(() => {
    const next = readTypeface()
    if (typeof document !== 'undefined') applyTypeface(next)
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

  useEffect(() => {
    applyTypeface(typeface)
    persistTypeface(typeface)
  }, [typeface])

  return (
    <AppearanceContext.Provider
      value={{
        fontSize,
        palette,
        typeface,
        setFontSize: setFontSizeState,
        setPalette: (next) => {
          setPaletteState(next)
          setTypefaceState(typefaceForPalette(next))
        },
        setTypeface: setTypefaceState,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  return useContext(AppearanceContext)
}
