import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { appDir, loadAppEnv, repoDir } from './vite.shared.ts'
import { notesPagesPlugin } from './vite-plugin-notes-pages.ts'

// Split heavy vendors out of the entry chunk so no single file crosses Vite's
// 500 kB warning; each group changes rarely and caches on its own.
const VENDOR_CHUNKS: [string, RegExp][] = [
  ['react', /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/],
  ['highlight', /[\\/]node_modules[\\/](highlight\.js|lowlight|rehype-highlight)[\\/]/],
  ['markdown', /[\\/]node_modules[\\/](react-markdown|remark-[^/\\]+|rehype-[^/\\]+|unified|micromark[^/\\]*|mdast-[^/\\]+|hast-[^/\\]+|unist-[^/\\]+|vfile[^/\\]*|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities[^/\\]*|html-url-attributes|trim-lines|devlop|bail|trough|zwitch|longest-streak|markdown-table|ccount|escape-string-regexp|estree-util-[^/\\]+|style-to-[^/\\]+|inline-style-parser)[\\/]/],
  ['radix', /[\\/]node_modules[\\/](radix-ui|@radix-ui[\\/][^/\\]+|cmdk|@floating-ui[\\/][^/\\]+|sonner)[\\/]/],
  ['icons', /[\\/]node_modules[\\/](@hugeicons[\\/][^/\\]+|lucide-react)[\\/]/],
]

function manualChunks(id: string) {
  // pnpm nests packages under .pnpm/<pkg>@<ver>/node_modules/<pkg>, so match the last segment.
  for (const [name, re] of VENDOR_CHUNKS) if (re.test(id)) return name
}

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
      rollupOptions: { output: { manualChunks } },
    },
  }
})
