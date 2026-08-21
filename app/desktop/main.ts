import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, Menu, nativeTheme, shell, type IpcMainInvokeEvent } from 'electron'

import {
  clearGithubToken,
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  getDefaultNotesRoot,
  getGithubRemotes,
  getGithubSyncErrors,
  getNotesRoot,
  getNotesRoots,
  hasGithubToken,
  isGithubTokenPersisted,
  listNotes,
  pickNotesFolder,
  readAsset,
  resolveNoteFile,
  setDefaultNotesRoot,
  setGithubRemotes,
  setGithubToken,
  setNotesRoot,
  setNotesRoots,
  writeNote,
  type CreateOpts,
} from './notes.ts'
import { openWithLaunches, type OpenWithLaunch } from '../src/lib/open-with.ts'
import {
  TITLE_BAR_HEIGHT,
  desktopWindowChrome,
  isHexColor,
  titleBarOverlay,
} from '../src/lib/title-bar.ts'

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

function spawnOpen(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

async function tryLaunch(abs: string, launch: OpenWithLaunch): Promise<void> {
  if (launch.kind === 'openPath') {
    const err = await shell.openPath(abs)
    if (err) throw new Error(err)
    return
  }
  await spawnOpen(launch.command, launch.args)
}

async function openNote(file: string): Promise<void> {
  const abs = resolveNoteFile(repoDir, file)
  if (!fs.existsSync(abs)) {
    throw new Error(`Note not found: ${abs}`)
  }

  let lastError: unknown
  for (const launch of openWithLaunches(process.platform, abs)) {
    try {
      await tryLaunch(abs, launch)
      return
    } catch (err) {
      lastError = err
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Could not open ${abs}`)
}

function wrap<A extends unknown[], R>(fn: (...args: A) => R) {
  return async (_event: IpcMainInvokeEvent, ...args: A) => fn(...args)
}

function windowFrom(event: IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender)
}

function applyTitleBarOverlay(win: BrowserWindow, overlay: unknown) {
  if (!overlay || typeof overlay !== 'object') return
  const color = (overlay as { color?: unknown }).color
  const symbolColor = (overlay as { symbolColor?: unknown }).symbolColor
  if (!isHexColor(color) || !isHexColor(symbolColor)) return
  win.setBackgroundColor(color)
  if (process.platform !== 'win32') return
  win.setTitleBarOverlay({
    color,
    symbolColor,
    height: TITLE_BAR_HEIGHT,
  })
}

function bindWindowState(win: BrowserWindow) {
  const send = () => {
    if (win.isDestroyed()) return
    win.webContents.send('window-maximize-changed', win.isMaximized())
  }
  win.on('maximize', send)
  win.on('unmaximize', send)
}

function createWindow(): BrowserWindow {
  const dark = nativeTheme.shouldUseDarkColors
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    title: 'Notes',
    icon: appIcon,
    backgroundColor: titleBarOverlay(dark).color,
    show: false,
    autoHideMenuBar: true,
    ...desktopWindowChrome(process.platform, dark),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  bindWindowState(win)
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
    ipcMain.handle('read-asset', wrap((file: string) => readAsset(repoDir, file)))
    ipcMain.handle('create-note', wrap((opts: CreateOpts) => createNote(repoDir, opts || {})))
    ipcMain.handle('create-folder', wrap((opts: CreateOpts) => createFolder(repoDir, opts || {})))
    ipcMain.handle('delete-note', wrap((file: string) => deleteNote(repoDir, file)))
    ipcMain.handle('delete-folder', wrap((opts: { path?: string; confirmName?: string; expectedNames?: string[] }) => deleteFolder(repoDir, opts || {})))
    ipcMain.handle('get-notes-root', wrap(() => getNotesRoot(repoDir)))
    ipcMain.handle('get-notes-roots', wrap(() => getNotesRoots(repoDir)))
    ipcMain.handle('set-notes-root', wrap((dir: string) => setNotesRoot(dir)))
    ipcMain.handle('set-notes-roots', wrap((dirs: string[]) => setNotesRoots(dirs || [])))
    ipcMain.handle('get-default-notes-root', wrap(() => getDefaultNotesRoot(repoDir)))
    ipcMain.handle('set-default-notes-root', wrap((dir: string) => setDefaultNotesRoot(repoDir, dir)))
    ipcMain.handle('pick-notes-folder', wrap(() => pickNotesFolder()))
    ipcMain.handle('get-github-remotes', wrap(() => getGithubRemotes()))
    ipcMain.handle('set-github-remotes', wrap((remotes: Parameters<typeof setGithubRemotes>[0]) => setGithubRemotes(remotes || [])))
    ipcMain.handle('has-github-token', wrap(() => hasGithubToken()))
    ipcMain.handle('github-token-persisted', wrap(() => isGithubTokenPersisted()))
    ipcMain.handle('set-github-token', wrap((token: string) => setGithubToken(String(token || ''))))
    ipcMain.handle('clear-github-token', wrap(() => clearGithubToken()))
    ipcMain.handle('get-github-sync-errors', wrap(() => getGithubSyncErrors()))
    ipcMain.handle('set-title-bar-overlay', (event, overlay: unknown) => {
      const win = windowFrom(event)
      if (win) applyTitleBarOverlay(win, overlay)
    })
    ipcMain.handle('window-minimize', (event) => {
      windowFrom(event)?.minimize()
    })
    ipcMain.handle('window-toggle-maximize', (event) => {
      const win = windowFrom(event)
      if (!win) return
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    })
    ipcMain.handle('window-close', (event) => {
      windowFrom(event)?.close()
    })
    ipcMain.handle('window-is-maximized', (event) => Boolean(windowFrom(event)?.isMaximized()))
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
