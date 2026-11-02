import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

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

const root = path.dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'runtime-notes',
    resolveId(id) { if (id === 'virtual:notes-pages') return '\0virtual:notes-pages' },
    load(id) { if (id === '\0virtual:notes-pages') return 'export default {}' },
  }],
  resolve: { alias: { '@': path.join(root, 'src') } },
  clearScreen: false,
  server: { host: '127.0.0.1', port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: { target: ['es2022', 'safari15'], sourcemap: false, rollupOptions: { output: { manualChunks } } },
})
