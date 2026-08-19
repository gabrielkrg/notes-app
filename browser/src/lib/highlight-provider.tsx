import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import {
  applyHighlightColor,
  persistHighlightColor,
  readHighlightColor,
  type HighlightColor,
} from './highlight.ts'

const HighlightContext = createContext<{
  highlight: HighlightColor
  setHighlight: (color: HighlightColor) => void
}>({
  highlight: 'yellow',
  setHighlight: () => {},
})

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [highlight, setHighlightState] = useState<HighlightColor>(() => {
    const color = readHighlightColor()
    if (typeof document !== 'undefined') applyHighlightColor(color)
    return color
  })

  useEffect(() => {
    applyHighlightColor(highlight)
    persistHighlightColor(highlight)
  }, [highlight])

  return (
    <HighlightContext.Provider value={{ highlight, setHighlight: setHighlightState }}>
      {children}
    </HighlightContext.Provider>
  )
}

export function useHighlight() {
  return useContext(HighlightContext)
}
