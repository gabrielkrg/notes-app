import { storageKey } from './config.ts'

export const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Yellow', value: 'oklch(0.88 0.16 95)' },
  { id: 'lime', label: 'Lime', value: 'oklch(0.88 0.17 135)' },
  { id: 'sky', label: 'Sky', value: 'oklch(0.86 0.1 230)' },
  { id: 'violet', label: 'Violet', value: 'oklch(0.84 0.13 300)' },
  { id: 'rose', label: 'Rose', value: 'oklch(0.84 0.14 15)' },
  { id: 'peach', label: 'Peach', value: 'oklch(0.86 0.12 55)' },
] as const

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]['id']

export const HIGHLIGHT_STORAGE_KEY = storageKey('highlight')

export function parseHighlightColor(value: unknown): HighlightColor {
  return HIGHLIGHT_COLORS.some((color) => color.id === value)
    ? (value as HighlightColor)
    : 'yellow'
}

export function highlightCustomProperties(id: HighlightColor): { '--highlight': string } {
  const color = HIGHLIGHT_COLORS.find((item) => item.id === id) ?? HIGHLIGHT_COLORS[0]
  return { '--highlight': color.value }
}

type HighlightStyleTarget = {
  style: { setProperty(name: string, value: string): void }
  dataset: { highlight?: string }
}

export function applyHighlightColor(
  id: HighlightColor,
  target: HighlightStyleTarget = document.documentElement,
): void {
  const color = parseHighlightColor(id)
  const vars = highlightCustomProperties(color)
  for (const [name, value] of Object.entries(vars)) target.style.setProperty(name, value)
  target.dataset.highlight = color
}

export function readHighlightColor(): HighlightColor {
  try {
    return parseHighlightColor(localStorage.getItem(HIGHLIGHT_STORAGE_KEY))
  } catch {
    return 'yellow'
  }
}

export function persistHighlightColor(id: HighlightColor): void {
  try {
    localStorage.setItem(HIGHLIGHT_STORAGE_KEY, parseHighlightColor(id))
  } catch {
    /* ignore */
  }
}
