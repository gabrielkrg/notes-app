import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import {
  applyFontSize,
  applyTypeface,
  persistFontSize,
  persistShowToc,
  persistTypeface,
  readFontSize,
  readShowToc,
  readTypeface,
  syncDesktopTitleBar,
  type FontSize,
  type Typeface,
} from './appearance.ts'

const AppearanceContext = createContext<{
  fontSize: FontSize
  typeface: Typeface
  showToc: boolean
  setFontSize: (size: FontSize) => void
  setTypeface: (typeface: Typeface) => void
  setShowToc: (show: boolean) => void
}>({
  fontSize: 'medium',
  typeface: 'grotesk-merriweather',
  showToc: true,
  setFontSize: () => {},
  setTypeface: () => {},
  setShowToc: () => {},
})

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const size = readFontSize()
    if (typeof document !== 'undefined') applyFontSize(size)
    return size
  })
  const [typeface, setTypefaceState] = useState<Typeface>(() => {
    const next = readTypeface()
    if (typeof document !== 'undefined') applyTypeface(next)
    return next
  })

  const [showToc, setShowTocState] = useState(readShowToc)

  useEffect(() => {
    persistShowToc(showToc)
  }, [showToc])

  useEffect(() => {
    applyFontSize(fontSize)
    persistFontSize(fontSize)
  }, [fontSize])

  useEffect(() => {
    syncDesktopTitleBar()
  }, [])

  useEffect(() => {
    applyTypeface(typeface)
    persistTypeface(typeface)
  }, [typeface])

  return (
    <AppearanceContext.Provider
      value={{
        fontSize,
        typeface,
        showToc,
        setFontSize: setFontSizeState,
        setTypeface: setTypefaceState,
        setShowToc: setShowTocState,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  return useContext(AppearanceContext)
}
