import { storageKey } from './config.ts'
import { TITLE_BAR_HEIGHT, titleBarOverlay, type TitleBarOverlay } from './title-bar.ts'

export const FONT_SIZES = [
  { id: 'small', label: 'Small', value: '16px' },
  { id: 'medium', label: 'Medium', value: '18px' },
  { id: 'large', label: 'Large', value: '21px' },
] as const

export type FontSize = (typeof FONT_SIZES)[number]['id']

export const PALETTES = [
  { id: 'ink', label: 'Ink', swatch: '#d4d4d8', faces: 'Grotesk + Merriweather' },
  { id: 'sepia', label: 'Sepia', swatch: '#c9a36b', faces: 'Literata' },
  { id: 'forest', label: 'Forest', swatch: '#5f8a68', faces: 'Mono + Grotesk' },
] as const

export type Palette = (typeof PALETTES)[number]['id']

export const FONT_SIZE_STORAGE_KEY = storageKey('font-size')
export const PALETTE_STORAGE_KEY = storageKey('palette')

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
}

type StyleTarget = {
  style: { setProperty(name: string, value: string): void }
  dataset: { fontSize?: string; palette?: string }
}

export function parseFontSize(value: unknown): FontSize {
  return FONT_SIZES.some((size) => size.id === value) ? (value as FontSize) : 'medium'
}

export function parsePalette(value: unknown): Palette {
  return PALETTES.some((palette) => palette.id === value) ? (value as Palette) : 'ink'
}

export function fontSizeCustomProperties(id: FontSize): { '--font-size-base': string } {
  const size = FONT_SIZES.find((item) => item.id === id) ?? FONT_SIZES[1]
  return { '--font-size-base': size.value }
}

const PALETTE_FONTS: Record<Palette, { sans: string; heading: string }> = {
  ink: {
    sans: 'var(--font-space-grotesk)',
    heading: 'var(--font-merriweather)',
  },
  sepia: {
    sans: 'var(--font-literata)',
    heading: 'var(--font-literata)',
  },
  forest: {
    sans: 'var(--font-jetbrains-mono)',
    heading: 'var(--font-space-grotesk)',
  },
}

export function paletteCustomProperties(id: Palette): {
  '--font-sans': string
  '--font-heading': string
} {
  const fonts = PALETTE_FONTS[parsePalette(id)]
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

export function applyPalette(id: Palette, target: StyleTarget = document.documentElement): void {
  const palette = parsePalette(id)
  const vars = paletteCustomProperties(palette)
  for (const [name, value] of Object.entries(vars)) target.style.setProperty(name, value)
  target.dataset.palette = palette
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

export function syncDesktopTitleBar(dark = document.documentElement.classList.contains('dark')): void {
  if (typeof window === 'undefined' || !window.desktop?.setTitleBarOverlay) return
  // Use known light/dark tokens. Parsing computed CSS fails for oklch and used
  // to leave the Windows caption overlay stuck on the dark fallback.
  void window.desktop.setTitleBarOverlay(titleBarOverlayForPalette(readPalette(), dark))
}
