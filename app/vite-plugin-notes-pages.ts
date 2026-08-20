import path from 'node:path'
import type { Plugin } from 'vite'

import { mergeRootPages } from './src/lib/notes-roots.ts'
import { loadNotesRoots } from './src/lib/notes-walk.ts'

export function notesPagesPlugin(notesRoots: string[] = []): Plugin {
  const virtualId = 'virtual:notes-pages'
  const resolvedId = `\0${virtualId}`
  const roots = notesRoots.map((root) => path.resolve(root).replace(/\\/g, '/'))

  function moduleSource() {
    const pages = mergeRootPages(loadNotesRoots(roots))
    return `export default ${JSON.stringify(pages)}\n`
  }

  return {
    name: 'notes-pages',
    enforce: 'pre',
    resolveId(id) {
      if (id === virtualId) return resolvedId
    },
    load(id) {
      if (id !== resolvedId) return
      if (!roots.length) return 'export default {}\n'
      return moduleSource()
    },
    configureServer(server) {
      for (const root of roots) server.watcher.add(root)
      const reload = (file: string) => {
        const abs = path.resolve(String(file || ''))
        if (
          !roots.some((root) => {
            const base = path.resolve(root)
            return abs === base || abs.startsWith(`${base}${path.sep}`)
          })
        ) {
          return
        }
        const mod = server.moduleGraph.getModuleById(resolvedId)
        if (mod) server.reloadModule(mod)
      }
      server.watcher.on('add', reload)
      server.watcher.on('change', reload)
      server.watcher.on('unlink', reload)
    },
  }
}
