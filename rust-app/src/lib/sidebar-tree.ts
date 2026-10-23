const DEPTH_PAD = [undefined, 'pl-8', 'pl-16', 'pl-24', 'pl-32']
const TREE_LINE = [
  'relative before:pointer-events-none before:absolute before:inset-y-1 before:left-4 before:w-px before:bg-sidebar-border',
  'relative before:pointer-events-none before:absolute before:inset-y-1 before:left-12 before:w-px before:bg-sidebar-border',
  'relative before:pointer-events-none before:absolute before:inset-y-1 before:left-20 before:w-px before:bg-sidebar-border',
]

export function depthPad(depth: number) {
  return DEPTH_PAD[Math.min(depth, DEPTH_PAD.length - 1)]
}

export function treeLine(depth: number) {
  return TREE_LINE[Math.min(depth, TREE_LINE.length - 1)]
}

type OpenableNode = {
  type: string
  id: string
  path: string
}

export function dirOpenId(nodes: OpenableNode[], route: string) {
  return (
    nodes.find(
      (node) =>
        node.type === 'dir' &&
        (route === node.path || route.startsWith(`${node.path}/`)),
    )?.id ?? null
  )
}

export function toggleOpenId(ids: string[], id: string, open: boolean) {
  if (open) return ids.includes(id) ? ids : [...ids, id]
  return ids.filter((item) => item !== id)
}

export function ensureOpenId(ids: string[], id: string | null) {
  if (!id || ids.includes(id)) return ids
  return [...ids, id]
}

export function folderOpenChange(next: boolean, href: string | undefined, route: string) {
  if (next && href && href !== route) return { open: true, go: href }
  return { open: next }
}
