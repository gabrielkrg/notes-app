export type LabeledRoot = {
  root: string
  label: string
}

export type RootFiles = {
  root: string
  files?: Record<string, string>
}

export type AppSettings = {
  notesRoot?: string
  notesRoots?: string[]
}

function normalizeRoot(root: string): string {
  return String(root || '').replace(/\\/g, '/').replace(/\/+$/, '')
}

function posixBasename(root: string): string {
  const normalized = normalizeRoot(root)
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || 'notes'
}

export function parseNotesRootEnv(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((part) => normalizeRoot(part.trim()))
    .filter(Boolean)
}

export function labelNotesRoots(roots: string[] = []): LabeledRoot[] {
  const used = new Set<string>()
  return [...roots].map((root) => {
    const normalized = normalizeRoot(root)
    const base = posixBasename(normalized)
    let label = base
    let n = 2
    while (used.has(label)) {
      label = `${base}-${n}`
      n += 1
    }
    used.add(label)
    return { root: normalized, label }
  })
}

export function attachedRootForDir(roots: string[] = [], dirPath = ''): string | null {
  const labeled = labelNotesRoots(roots)
  if (labeled.length < 2) return null
  const found = labeled.find((item) => item.label === dirPath)
  return found ? found.root : null
}

function relativeToRoot(globKey: string, root: string): string {
  const key = String(globKey || '').replace(/\\/g, '/').split('?')[0]
  const base = normalizeRoot(root)
  if (key === base) return ''
  if (base && key.startsWith(`${base}/`)) {
    return key.slice(base.length + 1)
  }
  if (key.startsWith('.') || key.startsWith('/')) {
    const folder = posixBasename(base)
    const marker = `/${folder}/`
    const at = key.lastIndexOf(marker)
    if (at !== -1) return key.slice(at + marker.length)
  }
  return key.replace(/^\.\//, '')
}

function hiddenRelative(relative: string): boolean {
  return relative.split('/').some((part) => part.startsWith('.'))
}

export function mergeRootPages(rootFiles: RootFiles[] = []): Record<string, string> {
  const labeled = labelNotesRoots(rootFiles.map((item) => item.root))
  const prefix = labeled.length > 1
  const out: Record<string, string> = {}
  for (let i = 0; i < rootFiles.length; i += 1) {
    const files = rootFiles[i].files || {}
    const { label } = labeled[i]
    for (const [key, content] of Object.entries(files)) {
      const relative = relativeToRoot(key, labeled[i].root)
      if (!relative || hiddenRelative(relative)) continue
      const virt = prefix ? `${label}/${relative}` : relative
      out[virt] = content
    }
  }
  return out
}

export function rootsFromSettings(settings: AppSettings = {}): string[] {
  if (Array.isArray(settings.notesRoots)) {
    return settings.notesRoots.map((dir) => String(dir || '').trim()).filter(Boolean)
  }
  if (settings.notesRoot) return [String(settings.notesRoot)]
  return []
}

export function resolveVirtualNote(virtualPath: string, labeledRoots: LabeledRoot[] = []): LabeledRoot & { relative: string } {
  const relative = String(virtualPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!labeledRoots.length) {
    throw new Error('No notes folders configured')
  }
  if (labeledRoots.length === 1) {
    return { ...labeledRoots[0], relative }
  }
  const slash = relative.indexOf('/')
  const label = slash === -1 ? relative : relative.slice(0, slash)
  const rest = slash === -1 ? '' : relative.slice(slash + 1)
  const found = labeledRoots.find((item) => item.label === label)
  if (!found) {
    throw new Error('Choose a notes folder first')
  }
  return { ...found, relative: rest }
}
