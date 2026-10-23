import { storageKey } from './config.ts'

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const SIDEBAR_WIDTH_DEFAULT = 16
export const SIDEBAR_WIDTH_MIN = 14
export const SIDEBAR_WIDTH_MAX = 32
export const SIDEBAR_DRAG_THRESHOLD_PX = 4

function widthKey() {
  return storageKey('sidebar-width')
}

export function clampSidebarWidth(rem: number) {
  if (!Number.isFinite(rem)) return SIDEBAR_WIDTH_DEFAULT
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, rem))
}

export function formatSidebarWidth(rem: number) {
  return `${clampSidebarWidth(rem)}rem`
}

export function parseSidebarWidth(raw: string | null) {
  if (raw == null || raw === '') return SIDEBAR_WIDTH_DEFAULT
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return SIDEBAR_WIDTH_DEFAULT
  return clampSidebarWidth(value)
}

export function loadSidebarWidth(storage: StorageLike) {
  try {
    return parseSidebarWidth(storage.getItem(widthKey()))
  } catch {
    return SIDEBAR_WIDTH_DEFAULT
  }
}

export function saveSidebarWidth(storage: StorageLike, rem: number) {
  storage.setItem(widthKey(), String(clampSidebarWidth(rem)))
}

export function widthFromPointer(startRem: number, deltaPx: number, remInPx: number) {
  const size = remInPx > 0 ? remInPx : 16
  return clampSidebarWidth(startRem + deltaPx / size)
}

export function isSidebarDrag(deltaPx: number, threshold = SIDEBAR_DRAG_THRESHOLD_PX) {
  return Math.abs(deltaPx) >= threshold
}
