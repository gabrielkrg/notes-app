export type ScrollView = {
  /** Item offset from the top of the scrollable content. */
  itemTop: number
  itemHeight: number
  /** Visible height of the scroll container. */
  viewHeight: number
  /** Full scrollable content height. */
  scrollHeight: number
  scrollTop: number
}

/** Keep this much of the viewport between the active item and either edge. */
export const SIDEBAR_SCROLL_MARGIN_PX = 48

/**
 * Scroll offset that puts the active item in the middle of the sidebar, or
 * null when it already sits comfortably inside the visible area.
 */
export function centerScrollTop(view: ScrollView, margin = SIDEBAR_SCROLL_MARGIN_PX) {
  const { itemTop, itemHeight, viewHeight, scrollHeight, scrollTop } = view
  if (!Number.isFinite(itemTop) || viewHeight <= 0) return null
  if (scrollHeight <= viewHeight) return null

  const safe = Math.min(margin, Math.max(0, (viewHeight - itemHeight) / 2))
  const top = itemTop - scrollTop
  const bottom = top + itemHeight
  if (top >= safe && bottom <= viewHeight - safe) return null

  const centered = itemTop - (viewHeight - itemHeight) / 2
  const next = Math.round(Math.min(Math.max(centered, 0), scrollHeight - viewHeight))
  return next === scrollTop ? null : next
}
