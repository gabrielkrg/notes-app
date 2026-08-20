import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { defineConfig } from 'vite'

import { appDir, desktopDir, loadAppEnv, repoDir } from '../vite.shared.ts'
import { notesPagesPlugin } from '../vite-plugin-notes-pages.ts'

export default defineConfig(({ mode }) => {
  const { notesRoots, port } = loadAppEnv(mode)

  return {
    root: appDir,
    envDir: appDir,
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      notesPagesPlugin(notesRoots),
      electron({
        main: {
          entry: path.join(desktopDir, 'main.ts'),
          vite: {
            build: {
              outDir: path.join(appDir, 'dist-electron'),
            },
          },
        },
        preload: {
          input: path.join(desktopDir, 'preload.ts'),
          vite: {
            build: {
              outDir: path.join(appDir, 'dist-electron'),
            },
          },
        },
      }),
    ],
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
