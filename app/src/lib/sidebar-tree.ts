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
