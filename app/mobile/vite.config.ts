import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { appDir, loadAppEnv, repoDir } from '../vite.shared.ts'
import { notesPagesPlugin } from '../vite-plugin-notes-pages.ts'

export default defineConfig(({ mode }) => {
  const { port } = loadAppEnv(mode)

  return {
    root: appDir,
    envDir: appDir,
    // Capacitor serves the bundle from a file-backed origin.
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      // No bundled notes: the mobile build reads everything from the device at
      // runtime, so `virtual:notes-pages` resolves to an empty map.
      notesPagesPlugin([]),
    ],
    define: {
      'import.meta.env.VITE_PLATFORM': JSON.stringify('mobile'),
      'import.meta.env.VITE_NOTES_ROOT': JSON.stringify(''),
    },
    resolve: {
      alias: {
        '@': path.join(appDir, 'src'),
      },
    },
    server: {
      port: port + 1,
      host: true,
      fs: {
        allow: [appDir, repoDir],
      },
    },
    build: {
      outDir: path.join(appDir, 'dist-mobile'),
      emptyOutDir: true,
    },
  }
})
