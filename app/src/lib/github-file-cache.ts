import fs from 'node:fs'
import path from 'node:path'

import type { GithubNotesCache, GithubNotesCacheEntry } from './github-notes.ts'

export function createFileGithubCache(dir: string): GithubNotesCache {
  return {
    async get(key: string) {
      try {
        const parsed = JSON.parse(fs.readFileSync(cacheFile(dir, key), 'utf8')) as Partial<GithubNotesCacheEntry>
        if (!parsed || typeof parsed.treeSha !== 'string' || !parsed.files || typeof parsed.files !== 'object') {
          return null
        }
        return { treeSha: parsed.treeSha, files: parsed.files }
      } catch {
        return null
      }
    },
    async set(key: string, value: GithubNotesCacheEntry) {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(cacheFile(dir, key), `${JSON.stringify(value)}\n`)
    },
  }
}

function cacheFile(dir: string, key: string): string {
  const safe = String(key || '').replace(/[^a-zA-Z0-9._-]+/g, '_') || 'remote'
  return path.join(dir, `${safe}.json`)
}
