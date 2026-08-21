import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { storageKey } from './config.ts'
import { titleBarOverlay } from './title-bar.ts'

export type Theme = 'light' | 'dark' | 'system'

const KEY = storageKey('theme')
const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
}>({
  theme: 'system',
  setTheme: () => {},
})

function isDark(theme: Theme): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function syncDesktopTitleBar(dark: boolean): void {
  if (!window.desktop?.setTitleBarOverlay) return
  // Use known light/dark tokens. Parsing computed CSS fails for oklch and used
  // to leave the Windows caption overlay stuck on the dark fallback.
  void window.desktop.setTitleBarOverlay(titleBarOverlay(dark))
}

export function applyTheme(theme: Theme): void {
  const dark = isDark(theme)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  syncDesktopTitleBar(dark)
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* ignore */
  }
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* ignore */
    }
    if (theme !== 'system') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
