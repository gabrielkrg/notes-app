import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { storageKey } from './config.ts'
import { overlayFromCssColors } from './title-bar.ts'

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

function resolvedCssColor(variable: string): string {
  const probe = document.createElement('div')
  probe.style.color = `var(${variable})`
  document.documentElement.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

function syncDesktopTitleBar(): void {
  if (!window.desktop?.setTitleBarOverlay) return
  void window.desktop.setTitleBarOverlay(
    overlayFromCssColors(resolvedCssColor('--background'), resolvedCssColor('--foreground')),
  )
}

export function applyTheme(theme: Theme): void {
  const dark = isDark(theme)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  syncDesktopTitleBar()
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
