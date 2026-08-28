import { storageKey } from './config.ts'
import { TITLE_BAR_HEIGHT, titleBarOverlay, type TitleBarOverlay } from './title-bar.ts'

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
    id: 'news',
    label: 'News',
    faces: 'Newsreader + Plex',
    sans: 'var(--font-newsreader)',
    heading: 'var(--font-ibm-plex-sans)',
  },
] as const

export type Typeface = (typeof TYPEFACES)[number]['id']

export const PALETTES = [
  { id: 'ink', label: 'Ink', swatch: '#d4d4d8', typeface: 'grotesk-merriweather' },
  { id: 'sepia', label: 'Sepia', swatch: '#c9a36b', typeface: 'literata' },
  { id: 'forest', label: 'Forest', swatch: '#5f8a68', typeface: 'mono-grotesk' },
  { id: 'slate', label: 'Slate', swatch: '#7a8fa3', typeface: 'grotesk' },
  { id: 'dusk', label: 'Dusk', swatch: '#c48b8b', typeface: 'literata-grotesk' },
  { id: 'midnight', label: 'Midnight', swatch: '#3d5a80', typeface: 'merriweather-mono' },
] as const

export type Palette = (typeof PALETTES)[number]['id']

export const FONT_SIZE_STORAGE_KEY = storageKey('font-size')
export const PALETTE_STORAGE_KEY = storageKey('palette')
export const TYPEFACE_STORAGE_KEY = storageKey('typeface')

const TITLE_BAR: Record<Palette, { light: TitleBarOverlay; dark: TitleBarOverlay }> = {
  ink: {
    light: titleBarOverlay(false),
    dark: titleBarOverlay(true),
  },
  sepia: {
    light: { color: '#f3ead8', symbolColor: '#3b3226', height: TITLE_BAR_HEIGHT },
    dark: { color: '#2a241c', symbolColor: '#efe4d2', height: TITLE_BAR_HEIGHT },
  },
  forest: {
    light: { color: '#e8f0e8', symbolColor: '#243028', height: TITLE_BAR_HEIGHT },
    dark: { color: '#1a221c', symbolColor: '#e4eee6', height: TITLE_BAR_HEIGHT },
  },
  slate: {
    light: { color: '#eef2f6', symbolColor: '#243040', height: TITLE_BAR_HEIGHT },
    dark: { color: '#1c2228', symbolColor: '#e8eef4', height: TITLE_BAR_HEIGHT },
  },
  dusk: {
    light: { color: '#f4e8e6', symbolColor: '#3a2428', height: TITLE_BAR_HEIGHT },
    dark: { color: '#2a1e20', symbolColor: '#f0e0de', height: TITLE_BAR_HEIGHT },
  },
  midnight: {
    light: { color: '#e8eef6', symbolColor: '#1a2438', height: TITLE_BAR_HEIGHT },
    dark: { color: '#121826', symbolColor: '#dce6f4', height: TITLE_BAR_HEIGHT },
  },
}

type StyleTarget = {
  style: { setProperty(name: string, value: string): void }
  dataset: { fontSize?: string; palette?: string; typeface?: string }
}

export function parseFontSize(value: unknown): FontSize {
  return FONT_SIZES.some((size) => size.id === value) ? (value as FontSize) : 'medium'
}

export function parsePalette(value: unknown): Palette {
  return PALETTES.some((palette) => palette.id === value) ? (value as Palette) : 'ink'
}

export function parseTypeface(value: unknown): Typeface {
  return TYPEFACES.some((typeface) => typeface.id === value) ? (value as Typeface) : 'grotesk-merriweather'
}

export function typefaceForPalette(id: Palette): Typeface {
  return PALETTES.find((palette) => palette.id === parsePalette(id))!.typeface
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

export function paletteCustomProperties(id: Palette): {
  '--font-sans': string
  '--font-heading': string
} {
  return typefaceCustomProperties(typefaceForPalette(id))
}

export function applyFontSize(id: FontSize, target: StyleTarget = document.documentElement): void {
  const size = parseFontSize(id)
  const vars = fontSizeCustomProperties(size)
  for (const [name, value] of Object.entries(vars)) target.style.setProperty(name, value)
  target.dataset.fontSize = size
}

export function applyPalette(id: Palette, target: StyleTarget = document.documentElement): void {
  target.dataset.palette = parsePalette(id)
}

export function applyTypeface(id: Typeface, target: StyleTarget = document.documentElement): void {
  const typeface = parseTypeface(id)
  const vars = typefaceCustomProperties(typeface)
  for (const [name, value] of Object.entries(vars)) target.style.setProperty(name, value)
  target.dataset.typeface = typeface
}

export function titleBarOverlayForPalette(id: Palette, dark: boolean): TitleBarOverlay {
  const pair = TITLE_BAR[parsePalette(id)]
  return dark ? pair.dark : pair.light
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

export function readPalette(): Palette {
  try {
    return parsePalette(localStorage.getItem(PALETTE_STORAGE_KEY))
  } catch {
    return 'ink'
  }
}

export function persistPalette(id: Palette): void {
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, parsePalette(id))
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
  return typefaceForPalette(readPalette())
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
  void window.desktop.setTitleBarOverlay(titleBarOverlayForPalette(readPalette(), dark))
}
