import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { isNoteFile } from './note-name.ts'

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'vendor',
  '__pycache__',
  'venv',
])

const DEFAULT_MAX_FILES = 5000
const DEFAULT_MAX_DIRS = 20_000
const DEFAULT_MAX_DEPTH = 24

export class NotesFolderTooLargeError extends Error {
  constructor(message = 'That folder is too large to open as notes. Choose a smaller folder of markdown files.') {
    super(message)
    this.name = 'NotesFolderTooLargeError'
  }
}

export type WalkNotesOptions = {
  maxFiles?: number
  maxDirs?: number
  maxDepth?: number
}

export function isTooBroadNotesRoot(dir: string, homeDir = os.homedir()): boolean {
  const abs = path.resolve(dir)
  const home = path.resolve(homeDir)
  if (abs === path.parse(abs).root) return true
  if (abs === home) return true
  const parent = path.dirname(home)
  if (abs === parent) {
    const name = path.basename(parent).toLowerCase()
    return name === 'home' || name === 'users'
  }
  return false
}

export function assertNotesRootLoadable(
  dir: string,
  homeDir = os.homedir(),
  options: WalkNotesOptions = {},
): void {
  if (isTooBroadNotesRoot(dir, homeDir)) {
    throw new Error('Choose a notes folder, not your home directory or an entire drive')
  }
  walkNotes(dir, options)
}

export function acceptedNotesRoots(
  dirs: string[],
  homeDir = os.homedir(),
  options: WalkNotesOptions = {},
): string[] {
  const next: string[] = []
  const seen = new Set<string>()
  for (const dir of dirs) {
    const abs = path.resolve(String(dir || ''))
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      throw new Error('Notes folder not found')
    }
    assertNotesRootLoadable(abs, homeDir, options)
    if (seen.has(abs)) continue
    seen.add(abs)
    next.push(abs)
  }
  return next
}

export function loadNotesRoots(
  roots: string[],
  homeDir = os.homedir(),
): { root: string; files: Record<string, string> }[] {
  const loaded: { root: string; files: Record<string, string> }[] = []
  for (const root of roots) {
    if (isTooBroadNotesRoot(root, homeDir)) continue
    try {
      loaded.push({ root, files: walkNotes(root) })
    } catch (err) {
      if (err instanceof NotesFolderTooLargeError) continue
      throw err
    }
  }
  return loaded
}

export function walkNotes(dir: string, options: WalkNotesOptions = {}): Record<string, string> {
  const out: Record<string, string> = {}
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES
  const maxDirs = options.maxDirs ?? DEFAULT_MAX_DIRS
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  let files = 0
  let dirs = 0

  function walk(current: string, rel: string, depth: number): void {
    if (!fs.existsSync(current) || depth > maxDepth) return
    dirs += 1
    if (dirs > maxDirs) throw new NotesFolderTooLargeError()

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
      const childRel = rel ? `${rel}/${entry.name}` : entry.name
      const abs = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        walk(abs, childRel, depth + 1)
      } else if (isNoteFile(entry.name)) {
        files += 1
        if (files > maxFiles) throw new NotesFolderTooLargeError()
        out[childRel] = fs.readFileSync(abs, 'utf8')
      }
    }
  }

  walk(dir, '', 0)
  return out
}
