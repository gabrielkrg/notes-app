/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NOTES_ROOT?: string
  readonly VITE_EDITOR_PROTOCOL?: string
  readonly VITE_STORAGE_PREFIX?: string
  readonly VITE_DEV_PORT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Navigator {
  readonly windowControlsOverlay?: WindowControlsOverlay
}
