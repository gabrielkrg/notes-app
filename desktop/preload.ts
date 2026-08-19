import { contextBridge, ipcRenderer } from 'electron'

import type { CreateNoteInput, DeleteFolderInput } from '../browser/src/lib/desktop.ts'

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
})
