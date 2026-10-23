export type DeleteNoteTarget = {
  kind: 'note'
  name: string
  file: string
}

export type DeleteFolderTarget = {
  kind: 'folder'
  name: string
  path: string
  expectedNames?: string[]
}

export type DeleteTarget = DeleteNoteTarget | DeleteFolderTarget

export type DeleteFolderOptions = {
  confirmName?: string
  expectedNames?: string[]
}

export function confirmFolderName(typed: string, allowedNames: string[] = []): boolean {
  const value = String(typed ?? '').trim()
  if (!value) return false
  return allowedNames.some((name) => String(name ?? '').trim() === value)
}
