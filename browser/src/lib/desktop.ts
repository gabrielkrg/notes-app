export type CreateNoteInput = {
  parent?: string
  name: string
}

export type CreatedNote = {
  file: string
  raw: string
}

export type DeleteFolderInput = {
  path: string
  confirmName?: string
  expectedNames?: string[]
}

export type DesktopApi = {
  openNote(file: string): Promise<void>
  listNotes(): Promise<Record<string, string>>
  writeNote(file: string, content: string): Promise<{ file: string }>
  createNote(opts: CreateNoteInput): Promise<CreatedNote>
  createFolder(opts: CreateNoteInput): Promise<CreatedNote>
  deleteNote(file: string): Promise<{ file: string }>
  deleteFolder(opts: DeleteFolderInput): Promise<{ path: string }>
  getNotesRoot(): Promise<string>
  getNotesRoots(): Promise<string[]>
  setNotesRoot(dir: string): Promise<string>
  setNotesRoots(dirs: string[]): Promise<string[]>
  pickNotesFolder(): Promise<string | null>
}

declare global {
  interface Window {
    desktop?: DesktopApi
  }
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.desktop?.listNotes)
}
