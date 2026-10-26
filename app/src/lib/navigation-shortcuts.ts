type ShortcutEvent = {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}

export function navigationShortcut(event: ShortcutEvent, typing = false) {
  const key = event.key.toLowerCase()
  const mod = event.ctrlKey || event.metaKey
  if (event.altKey) {
    return !mod && !event.shiftKey && key === 'home' ? 'dashboard' : null
  }
  if (!mod) return key === '?' && !typing ? 'guide' : null
  if (event.shiftKey) {
    if (key === 'g') return 'graph'
    if (key === 'b') return 'bookmarks'
    return null
  }
  if (key === 'e') return 'menu'
  if (key === '/') return 'guide'
  if (key === 'd') return 'bookmark'
  return null
}

export function isTypingTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))
}

export function focusNoteContent() {
  document.querySelector<HTMLElement>('[data-note-content]')?.focus({ preventScroll: true })
}
