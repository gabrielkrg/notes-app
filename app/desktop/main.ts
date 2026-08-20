import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, Menu, shell, type IpcMainInvokeEvent } from 'electron'

import {
  clearGithubToken,
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  getGithubRemotes,
  getGithubSyncErrors,
  getNotesRoot,
  getNotesRoots,
  hasGithubToken,
  isGithubTokenPersisted,
  listNotes,
  pickNotesFolder,
  resolveNoteFile,
  setGithubRemotes,
  setGithubToken,
  setNotesRoot,
  setNotesRoots,
  writeNote,
  type CreateOpts,
} from './notes.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageDir = path.join(__dirname, '..')
const repoDir = path.join(packageDir, '..')
const appIcon = [
  path.join(packageDir, 'dist/favicon/favicon-96x96.png'),
  path.join(packageDir, 'public/favicon/favicon-96x96.png'),
].find((file) => fs.existsSync(file))

let mainWindow: BrowserWindow | null = null

function focusMainWindow() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  app.focus({ steal: true })
}

function openNote(file: string): Promise<void> {
  const abs = resolveNoteFile(repoDir, file)
  if (!fs.existsSync(abs)) {
    return Promise.reject(new Error(`Note not found: ${abs}`))
  }

  return new Promise((resolve, reject) => {
    const child = spawn('cursor', [abs], {
      detached: true,
      stdio: 'ignore',
    })
    child.once('error', async () => {
      const err = await shell.openPath(abs)
      if (err) reject(new Error(err))
      else resolve()
    })
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

function wrap<A extends unknown[], R>(fn: (...args: A) => R) {
  return async (_event: IpcMainInvokeEvent, ...args: A) => fn(...args)
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    title: 'Notes',
    icon: appIcon,
    backgroundColor: '#0a0a0a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(packageDir, 'dist/index.html'))
  }

  return win
}

Menu.setApplicationMenu(null)

// GNOME/Wayland matches the dock icon via app_id, which must equal the
// installed .desktop filename (notes-desk.desktop). Call this before ready.
if (process.platform === 'linux') {
  app.setDesktopName('notes-desk.desktop')
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    focusMainWindow()
  })

  app.whenReady().then(() => {
    ipcMain.handle('open-note', (_event, file: string) => openNote(String(file || '')))
    ipcMain.handle('list-notes', wrap(() => listNotes(repoDir)))
    ipcMain.handle('write-note', wrap((file: string, content: string) => writeNote(repoDir, file, content)))
    ipcMain.handle('create-note', wrap((opts: CreateOpts) => createNote(repoDir, opts || {})))
    ipcMain.handle('create-folder', wrap((opts: CreateOpts) => createFolder(repoDir, opts || {})))
    ipcMain.handle('delete-note', wrap((file: string) => deleteNote(repoDir, file)))
    ipcMain.handle('delete-folder', wrap((opts: { path?: string; confirmName?: string; expectedNames?: string[] }) => deleteFolder(repoDir, opts || {})))
    ipcMain.handle('get-notes-root', wrap(() => getNotesRoot(repoDir)))
    ipcMain.handle('get-notes-roots', wrap(() => getNotesRoots(repoDir)))
    ipcMain.handle('set-notes-root', wrap((dir: string) => setNotesRoot(dir)))
    ipcMain.handle('set-notes-roots', wrap((dirs: string[]) => setNotesRoots(dirs || [])))
    ipcMain.handle('pick-notes-folder', wrap(() => pickNotesFolder()))
    ipcMain.handle('get-github-remotes', wrap(() => getGithubRemotes()))
    ipcMain.handle('set-github-remotes', wrap((remotes: Parameters<typeof setGithubRemotes>[0]) => setGithubRemotes(remotes || [])))
    ipcMain.handle('has-github-token', wrap(() => hasGithubToken()))
    ipcMain.handle('github-token-persisted', wrap(() => isGithubTokenPersisted()))
    ipcMain.handle('set-github-token', wrap((token: string) => setGithubToken(String(token || ''))))
    ipcMain.handle('clear-github-token', wrap(() => clearGithubToken()))
    ipcMain.handle('get-github-sync-errors', wrap(() => getGithubSyncErrors()))
    mainWindow = createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      } else {
        focusMainWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
