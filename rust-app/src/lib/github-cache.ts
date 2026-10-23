import type { GithubNotesCache, GithubNotesCacheEntry } from './github-notes.ts'

export function createMemoryGithubCache(
  seed: Record<string, GithubNotesCacheEntry> = {},
): GithubNotesCache {
  const store = new Map<string, GithubNotesCacheEntry>(Object.entries(seed))
  return {
    async get(key: string) {
      return store.get(key) ?? null
    },
    async set(key: string, value: GithubNotesCacheEntry) {
      store.set(key, value)
    },
  }
}

export function createIndexedDbGithubCache(
  indexedDBImpl: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB,
): GithubNotesCache {
  if (!indexedDBImpl) return createMemoryGithubCache()

  const dbp = openGithubCacheDb(indexedDBImpl)
  return {
    async get(key: string) {
      const db = await dbp
      return new Promise((resolve, reject) => {
        const tx = db.transaction('trees', 'readonly')
        const req = tx.objectStore('trees').get(key)
        req.onsuccess = () => {
          const row = req.result as (GithubNotesCacheEntry & { key?: string }) | undefined
          if (!row?.treeSha || !row.files) {
            resolve(null)
            return
          }
          resolve({ treeSha: row.treeSha, files: row.files })
        }
        req.onerror = () => reject(req.error)
      })
    },
    async set(key: string, value: GithubNotesCacheEntry) {
      const db = await dbp
      return new Promise((resolve, reject) => {
        const tx = db.transaction('trees', 'readwrite')
        tx.objectStore('trees').put({ key, ...value })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    },
  }
}

function openGithubCacheDb(indexedDBImpl: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDBImpl.open('notes-github-cache', 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('trees')) {
        db.createObjectStore('trees', { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
