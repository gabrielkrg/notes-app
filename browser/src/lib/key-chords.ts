export const CTRL_K_CHORD_MS = 500

export type ChordAction = 'folder' | 'search' | 'pending'

export type ChordHandlers = {
  searchOpen?: boolean
  onSearch?: () => void
  onOpenFolder?: () => void
}

export class CtrlKChord {
  windowMs: number
  pending: boolean
  timer: ReturnType<typeof setTimeout> | null

  constructor(windowMs = CTRL_K_CHORD_MS) {
    this.windowMs = windowMs
    this.pending = false
    this.timer = null
  }

  handle(event: { key?: string; metaKey?: boolean; ctrlKey?: boolean; preventDefault(): void }, {
    searchOpen = false,
    onSearch,
    onOpenFolder,
  }: ChordHandlers = {}): ChordAction | null {
    const mod = event.metaKey || event.ctrlKey
    const key = String(event.key || '').toLowerCase()

    if (this.pending && mod && key === 'o') {
      event.preventDefault()
      this.clear()
      onOpenFolder?.()
      return 'folder'
    }

    if (mod && key === 'k') {
      event.preventDefault()
      this.clear()
      if (searchOpen) {
        onSearch?.()
        return 'search'
      }
      this.pending = true
      this.timer = setTimeout(() => {
        this.pending = false
        this.timer = null
        onSearch?.()
      }, this.windowMs)
      return 'pending'
    }

    return null
  }

  clear(): void {
    this.pending = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  dispose(): void {
    this.clear()
  }
}
