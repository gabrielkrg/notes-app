import { Preferences } from '@capacitor/preferences'

import type { GithubNotesCache, GithubNotesCacheEntry } from '../src/lib/github-notes.ts'
import type { AppSettings } from '../src/lib/notes-roots.ts'

const SETTINGS_KEY = 'notes.settings'
const TOKEN_KEY = 'notes.githubToken'
const CACHE_PREFIX = 'notes.githubCache.'

export async function readSettings(): Promise<AppSettings> {
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY })
    if (!value) return {}
    return JSON.parse(value) as AppSettings
  } catch {
    return {}
  }
}

export async function writeSettings(next: AppSettings): Promise<void> {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(next) })
}

/**
 * The token lives in Preferences, which is app-private storage
 * (SharedPreferences on Android, UserDefaults on iOS) but is not hardware
 * encrypted the way Electron's `safeStorage` is. Swap in a Keychain/Keystore
 * plugin here if the threat model needs it.
 */
export async function readGithubToken(): Promise<string> {
  try {
    const { value } = await Preferences.get({ key: TOKEN_KEY })
    return value || ''
  } catch {
    return ''
  }
}

export async function writeGithubToken(token: string): Promise<void> {
  if (!token) {
    await Preferences.remove({ key: TOKEN_KEY })
    return
  }
  await Preferences.set({ key: TOKEN_KEY, value: token })
}

/** Preferences-backed twin of `createFileGithubCache`. */
export function createPreferencesGithubCache(): GithubNotesCache {
  return {
    async get(key: string) {
      try {
        const { value } = await Preferences.get({ key: cacheKey(key) })
        if (!value) return null
        const parsed = JSON.parse(value) as Partial<GithubNotesCacheEntry>
        if (!parsed || typeof parsed.treeSha !== 'string' || !parsed.files || typeof parsed.files !== 'object') {
          return null
        }
        return { treeSha: parsed.treeSha, files: parsed.files }
      } catch {
        return null
      }
    },
    async set(key: string, value: GithubNotesCacheEntry) {
      try {
        await Preferences.set({ key: cacheKey(key), value: JSON.stringify(value) })
      } catch {
        // A repo too large for the preferences store just means no cache.
      }
    },
  }
}

function cacheKey(key: string): string {
  const safe = String(key || '').replace(/[^a-zA-Z0-9._-]+/g, '_') || 'remote'
  return `${CACHE_PREFIX}${safe}`
}
