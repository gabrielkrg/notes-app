import { storageKey } from './config.ts'
import { titleBarOverlay } from './title-bar.ts'

export const FONT_SIZES = [
  { id: 'small', label: 'Small', value: '16px' },
  { id: 'medium', label: 'Medium', value: '18px' },
  { id: 'large', label: 'Large', value: '21px' },
] as const

export type FontSize = (typeof FONT_SIZES)[number]['id']

export const TYPEFACES = [
  {
    id: 'grotesk-merriweather',
    label: 'Grotesk + Merriweather',
    faces: 'Grotesk + Merriweather',
    sans: 'var(--font-space-grotesk)',
    heading: 'var(--font-merriweather)',
  },
  {
    id: 'literata',
    label: 'Literata',
    faces: 'Literata',
    sans: 'var(--font-literata)',
    heading: 'var(--font-literata)',
  },
  {
    id: 'mono-grotesk',
    label: 'Mono + Grotesk',
    faces: 'Mono + Grotesk',
    sans: 'var(--font-jetbrains-mono)',
    heading: 'var(--font-space-grotesk)',
  },
  {
    id: 'grotesk',
    label: 'Grotesk',
    faces: 'Grotesk',
    sans: 'var(--font-space-grotesk)',
    heading: 'var(--font-space-grotesk)',
  },
  {
    id: 'literata-grotesk',
    label: 'Literata + Grotesk',
    faces: 'Literata + Grotesk',
    sans: 'var(--font-literata)',
    heading: 'var(--font-space-grotesk)',
  },
  {
    id: 'merriweather-mono',
    label: 'Merriweather + Mono',
    faces: 'Merriweather + Mono',
    sans: 'var(--font-merriweather)',
    heading: 'var(--font-jetbrains-mono)',
  },
  {
    id: 'plex',
    label: 'Plex',
    faces: 'IBM Plex Sans',
    sans: 'var(--font-ibm-plex-sans)',
    heading: 'var(--font-ibm-plex-sans)',
  },
  {
    id: 'source',
    label: 'Source',
    faces: 'Source Serif',
    sans: 'var(--font-source-serif)',
    heading: 'var(--font-source-serif)',
  },
  {
    id: 'jetbrains',
    label: 'JetBrains Mono',
    faces: 'JetBrains Mono',
    sans: 'var(--font-jetbrains-mono)',
    heading: 'var(--font-jetbrains-mono)',
  },
  {
    id: 'news',
    label: 'News',
    faces: 'Newsreader + Plex',
    sans: 'var(--font-newsreader)',
    heading: 'var(--font-ibm-plex-sans)',
  },
] as const

export type Typeface = (typeof TYPEFACES)[number]['id']

export const FONT_SIZE_STORAGE_KEY = storageKey('font-size')
export const TYPEFACE_STORAGE_KEY = storageKey('typeface')
export const TOC_STORAGE_KEY = storageKey('toc')

type StyleTarget = {
  style: { setProperty(name: string, value: string): void }
  dataset: { fontSize?: string; typeface?: string }
}

export function parseFontSize(value: unknown): FontSize {
  return FONT_SIZES.some((size) => size.id === value) ? (value as FontSize) : 'medium'
}

export function parseTypeface(value: unknown): Typeface {
  return TYPEFACES.some((typeface) => typeface.id === value) ? (value as Typeface) : 'grotesk-merriweather'
}

export function fontSizeCustomProperties(id: FontSize): { '--font-size-base': string } {
  const size = FONT_SIZES.find((item) => item.id === id) ?? FONT_SIZES[1]
  return { '--font-size-base': size.value }
}

function typefaceEntry(id: Typeface): (typeof TYPEFACES)[number] {
  return TYPEFACES.find((item) => item.id === parseTypeface(id)) ?? TYPEFACES[0]
}

export function typefaceCustomProperties(id: Typeface): {
  '--font-sans': string
  '--font-heading': string
} {
  const fonts = typefaceEntry(id)
  return {
    '--font-sans': fonts.sans,
    '--font-heading': fonts.heading,
  }
}

export function applyFontSize(id: FontSize, target: StyleTarget = document.documentElement): void {
  const size = parseFontSize(id)
  const vars = fontSizeCustomProperties(size)
  for (const [name, value] of Object.entries(vars)) target.style.setProperty(name, value)
  target.dataset.fontSize = size
}

export function applyTypeface(id: Typeface, target: StyleTarget = document.documentElement): void {
  const typeface = parseTypeface(id)
  const vars = typefaceCustomProperties(typeface)
  for (const [name, value] of Object.entries(vars)) target.style.setProperty(name, value)
  target.dataset.typeface = typeface
}

export function readFontSize(): FontSize {
  try {
    return parseFontSize(localStorage.getItem(FONT_SIZE_STORAGE_KEY))
  } catch {
    return 'medium'
  }
}

export function persistFontSize(id: FontSize): void {
  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, parseFontSize(id))
  } catch {
    /* ignore */
  }
}

export function readTypeface(): Typeface {
  try {
    const stored = localStorage.getItem(TYPEFACE_STORAGE_KEY)
    if (TYPEFACES.some((typeface) => typeface.id === stored)) return stored as Typeface
  } catch {
    /* ignore */
  }
  return 'grotesk-merriweather'
}

export function persistTypeface(id: Typeface): void {
  try {
    localStorage.setItem(TYPEFACE_STORAGE_KEY, parseTypeface(id))
  } catch {
    /* ignore */
  }
}

export function syncDesktopTitleBar(dark = document.documentElement.classList.contains('dark')): void {
  if (typeof window === 'undefined' || !window.desktop?.setTitleBarOverlay) return
  // Use known light/dark tokens. Parsing computed CSS fails for oklch and used
  // to leave the Windows caption overlay stuck on the dark fallback.
  void window.desktop.setTitleBarOverlay(titleBarOverlay(dark))
}

/** Whether the "On this page" outline is shown beside notes. Defaults to shown. */
export function readShowToc(): boolean {
  try {
    return localStorage.getItem(TOC_STORAGE_KEY) !== 'hidden'
  } catch {
    return true
  }
}

export function persistShowToc(show: boolean): void {
  try {
    localStorage.setItem(TOC_STORAGE_KEY, show ? 'shown' : 'hidden')
  } catch {
    /* ignore */
  }
}
