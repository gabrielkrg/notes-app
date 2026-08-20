import { contextBridge, ipcRenderer } from 'electron'

import type { CreateNoteInput, DeleteFolderInput, GithubRemoteInput } from '../browser/src/lib/desktop.ts'

contextBridge.exposeInMainWorld('desktop', {
  openNote: (file: string) => ipcRenderer.invoke('open-note', file),
  listNotes: () => ipcRenderer.invoke('list-notes'),
  writeNote: (file: string, content: string) => ipcRenderer.invoke('write-note', file, content),
  createNote: (opts: CreateNoteInput) => ipcRenderer.invoke('create-note', opts),
  createFolder: (opts: CreateNoteInput) => ipcRenderer.invoke('create-folder', opts),
  deleteNote: (file: string) => ipcRenderer.invoke('delete-note', file),
  deleteFolder: (opts: DeleteFolderInput) => ipcRenderer.invoke('delete-folder', opts),
  getNotesRoot: () => ipcRenderer.invoke('get-notes-root'),
  getNotesRoots: () => ipcRenderer.invoke('get-notes-roots'),
  setNotesRoot: (dir: string) => ipcRenderer.invoke('set-notes-root', dir),
  setNotesRoots: (dirs: string[]) => ipcRenderer.invoke('set-notes-roots', dirs),
  pickNotesFolder: () => ipcRenderer.invoke('pick-notes-folder'),
  getGithubRemotes: () => ipcRenderer.invoke('get-github-remotes'),
  setGithubRemotes: (remotes: GithubRemoteInput[]) => ipcRenderer.invoke('set-github-remotes', remotes),
  hasGithubToken: () => ipcRenderer.invoke('has-github-token'),
  githubTokenPersisted: () => ipcRenderer.invoke('github-token-persisted'),
  setGithubToken: (token: string) => ipcRenderer.invoke('set-github-token', token),
  clearGithubToken: () => ipcRenderer.invoke('clear-github-token'),
  getGithubSyncErrors: () => ipcRenderer.invoke('get-github-sync-errors'),
})
