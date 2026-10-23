import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

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
  build: { target: ['es2022', 'safari15'], sourcemap: false },
})
