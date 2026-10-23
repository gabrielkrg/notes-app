import type { DesktopApi } from './lib/desktop'

type RustWindow = Window & {
  __TAURI__?: {
    core: { invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> }
    window: { getCurrentWindow(): { startDragging(): Promise<void> } }
    event: { listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<() => void> }
  }
}

export async function installRustApi(): Promise<void> {
  const tauri = (window as RustWindow).__TAURI__
  if (!tauri) return
  const call = <T,>(operation: string, args: Record<string, unknown> = {}): Promise<T> =>
    tauri.core.invoke<T>('notes_command', { operation, args }).catch((error: unknown) => {
      throw new Error(typeof error === 'string' ? error : String(error))
    })
  const platform = await call<string>('platform')
  const api: DesktopApi = {
    platform,
    setTitleBarOverlay: (overlay) => call('set_title_bar_overlay', { overlay }),
    minimizeWindow: () => call('window_minimize'),
    toggleMaximizeWindow: () => call('window_toggle_maximize'),
    closeWindow: () => call('window_close'),
    isMaximized: () => call('window_is_maximized'),
    onMaximizeChange: (callback) => {
      let disposed = false
      let unlisten: (() => void) | undefined
      void tauri.event.listen<boolean>('window-maximize-changed', ({ payload }) => callback(payload))
        .then((stop) => { if (disposed) stop(); else unlisten = stop })
      return () => { disposed = true; unlisten?.() }
    },
    openNote: (file) => call('open_note', { file }),
    openInBrowser: (file) => call('open_in_browser', { file }),
    listNotes: (refreshGithub = false) => call('list_notes', { refreshGithub }),
    searchNotes: (query) => call('search_notes', { query }),
    writeNote: (file, content) => call('write_note', { file, content }),
    readAsset: (file) => call('read_asset', { file }),
    createNote: (opts) => call('create_note', opts),
    createFolder: (opts) => call('create_folder', opts),
    deleteNote: (file) => call('delete_note', { file }),
    deleteFolder: (opts) => call('delete_folder', opts),
    renameNote: (opts) => call('rename_note', opts),
    renameFolder: (opts) => call('rename_folder', opts),
    getNotesRoot: () => call('get_notes_root'),
    getNotesRoots: () => call('get_notes_roots'),
    setNotesRoot: (dir) => call('set_notes_root', { dir }),
    setNotesRoots: (dirs) => call('set_notes_roots', { dirs }),
    getDefaultNotesRoot: () => call('get_default_notes_root'),
    setDefaultNotesRoot: (dir) => call('set_default_notes_root', { dir }),
    pickNotesFolder: () => call('pick_notes_folder'),
    getGithubRemotes: () => call('get_github_remotes'),
    setGithubRemotes: (remotes) => call('set_github_remotes', { remotes }),
    hasGithubToken: () => call('has_github_token'),
    githubTokenPersisted: () => call('github_token_persisted'),
    setGithubToken: (token) => call('set_github_token', { token }),
    clearGithubToken: () => call('clear_github_token'),
    getGithubSyncErrors: () => call('get_github_sync_errors'),
  }
  window.desktop = api

  document.addEventListener('click', (event) => {
    const element = event.target instanceof Element ? event.target : null
    const link = element?.closest('a[href]')
    const href = link?.getAttribute('href') || ''
    if (/^(https?:|mailto:)/i.test(href)) {
      event.preventDefault()
      void call('open_url', { url: href })
    }
  })

  // WebKit does not implement Electron's CSS app-region property.
  document.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || event.detail > 1) return
    const element = event.target instanceof Element ? event.target : null
    if (element?.closest('.titlebar') && !element.closest('button,a,input,[role="button"],[role="combobox"]')) {
      void tauri.window.getCurrentWindow().startDragging()
    }
  })
  document.addEventListener('dblclick', (event) => {
    const element = event.target instanceof Element ? event.target : null
    if (element?.closest('.titlebar') && !element.closest('button,a,input,[role="button"],[role="combobox"]')) {
      void api.toggleMaximizeWindow()
    }
  })
}
