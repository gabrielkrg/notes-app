import { storageKey } from './config.ts'

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const SPLIT_WIDTH_DEFAULT = 50
export const SPLIT_WIDTH_MIN = 25
export const SPLIT_WIDTH_MAX = 75

function widthKey() {
  return storageKey('split-width')
}

export function clampSplitWidth(percent: number) {
  if (!Number.isFinite(percent)) return SPLIT_WIDTH_DEFAULT
  return Math.min(SPLIT_WIDTH_MAX, Math.max(SPLIT_WIDTH_MIN, percent))
}

export function formatSplitWidth(percent: number) {
  return `${clampSplitWidth(percent)}%`
}

export function parseSplitWidth(raw: string | null) {
  if (raw == null || raw === '') return SPLIT_WIDTH_DEFAULT
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return SPLIT_WIDTH_DEFAULT
  return clampSplitWidth(value)
}

export function loadSplitWidth(storage: StorageLike) {
  try {
    return parseSplitWidth(storage.getItem(widthKey()))
  } catch {
    return SPLIT_WIDTH_DEFAULT
  }
}

export function saveSplitWidth(storage: StorageLike, percent: number) {
  storage.setItem(widthKey(), String(clampSplitWidth(percent)))
}

export function splitWidthFromPointer(startPercent: number, deltaPx: number, containerPx: number) {
  if (!(containerPx > 0)) return clampSplitWidth(startPercent)
  return clampSplitWidth(startPercent + (deltaPx / containerPx) * 100)
}
