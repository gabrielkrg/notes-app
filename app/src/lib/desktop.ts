export type CreateNoteInput = {
  parent?: string
  name: string
  type?: 'markdown' | 'html' | 'css' | 'js'
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

export type GithubRemoteInput = {
  id: string
  url: string
  owner: string
  repo: string
  ref?: string
  subpath?: string
}

export type NotesSnapshot = {
  files: Record<string, string>
  githubFiles: string[]
  githubNames?: Record<string, string>
}

export type AssetResult = {
  file: string
  dataUrl: string
}

export type DesktopApi = {
  openNote(file: string): Promise<void>
  listNotes(): Promise<NotesSnapshot>
  writeNote(file: string, content: string): Promise<{ file: string }>
  readAsset(file: string): Promise<AssetResult>
  createNote(opts: CreateNoteInput): Promise<CreatedNote>
  createFolder(opts: CreateNoteInput): Promise<CreatedNote>
  deleteNote(file: string): Promise<{ file: string }>
  deleteFolder(opts: DeleteFolderInput): Promise<{ path: string }>
  getNotesRoot(): Promise<string>
  getNotesRoots(): Promise<string[]>
  setNotesRoot(dir: string): Promise<string>
  setNotesRoots(dirs: string[]): Promise<string[]>
  getDefaultNotesRoot(): Promise<string>
  setDefaultNotesRoot(dir: string): Promise<string>
  pickNotesFolder(): Promise<string | null>
  getGithubRemotes(): Promise<GithubRemoteInput[]>
  setGithubRemotes(remotes: GithubRemoteInput[]): Promise<GithubRemoteInput[]>
  hasGithubToken(): Promise<boolean>
  githubTokenPersisted(): Promise<boolean>
  setGithubToken(token: string): Promise<{ persisted: boolean }>
  clearGithubToken(): Promise<void>
  getGithubSyncErrors(): Promise<{ id: string; message: string }[]>
}

declare global {
  interface Window {
    desktop?: DesktopApi
  }
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.desktop?.listNotes)
}
