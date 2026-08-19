import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { browserDir, loadAppEnv, rootDir } from '../vite.shared.ts'
import { notesPagesPlugin } from '../vite-plugin-notes-pages.ts'

export default defineConfig(({ mode }) => {
  const { notesRoots, port } = loadAppEnv(mode)

  return {
    root: browserDir,
    envDir: rootDir,
    base: './',
    plugins: [react(), tailwindcss(), notesPagesPlugin(notesRoots)],
    define: {
      'import.meta.env.VITE_NOTES_ROOT': JSON.stringify(notesRoots.join(',')),
    },
    resolve: {
      alias: {
        '@': path.join(browserDir, 'src'),
      },
    },
    server: {
      port,
      fs: {
        allow: [rootDir, ...notesRoots],
      },
    },
    build: {
      outDir: path.join(rootDir, 'dist'),
      emptyOutDir: true,
    },
  }
})
