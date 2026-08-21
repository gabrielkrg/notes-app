export const TITLE_BAR_HEIGHT = 56

export type TitleBarOverlay = {
  color: string
  symbolColor: string
  height: number
}

export function titleBarOverlay(dark: boolean): TitleBarOverlay {
  return {
    color: dark ? '#252525' : '#ffffff',
    symbolColor: dark ? '#fafafa' : '#262626',
    height: TITLE_BAR_HEIGHT,
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const hex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

export function parseCssRgb(value: string): { r: number; g: number; b: number } | null {
  const match = String(value || '').match(
    /rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)/,
  )
  if (!match) return null
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
}

export function overlayFromCssColors(background: string, foreground: string): TitleBarOverlay {
  const bg = parseCssRgb(background)
  const fg = parseCssRgb(foreground)
  if (!bg || !fg) return titleBarOverlay(true)
  return {
    color: rgbToHex(bg.r, bg.g, bg.b),
    symbolColor: rgbToHex(fg.r, fg.g, fg.b),
    height: TITLE_BAR_HEIGHT,
  }
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

export function desktopWindowChrome(platform: string, dark: boolean) {
  if (platform === 'darwin') {
    return {
      frame: true,
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 16, y: 18 },
    }
  }
  if (platform === 'linux') {
    return {
      frame: false,
      titleBarStyle: 'hidden' as const,
    }
  }
  return {
    frame: true,
    titleBarStyle: 'hidden' as const,
    titleBarOverlay: titleBarOverlay(dark),
  }
}

export function needsCustomWindowButtons(
  platform: string | undefined,
  overlayVisible: boolean,
): boolean {
  if (!platform || platform === 'darwin') return false
  if (platform === 'linux') return true
  return !overlayVisible
}
