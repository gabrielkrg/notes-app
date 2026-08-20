import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { appDir, loadAppEnv, repoDir } from './vite.shared.ts'
import { notesPagesPlugin } from './vite-plugin-notes-pages.ts'

export default defineConfig(({ mode }) => {
  const { notesRoots, port } = loadAppEnv(mode)

  return {
    root: appDir,
    envDir: appDir,
    base: './',
    plugins: [react(), tailwindcss(), notesPagesPlugin(notesRoots)],
    define: {
      'import.meta.env.VITE_NOTES_ROOT': JSON.stringify(notesRoots.join(',')),
    },
    resolve: {
      alias: {
        '@': path.join(appDir, 'src'),
      },
    },
    server: {
      port,
      fs: {
        allow: [appDir, repoDir, ...notesRoots],
      },
    },
    build: {
      outDir: path.join(appDir, 'dist'),
      emptyOutDir: true,
    },
  }
})
