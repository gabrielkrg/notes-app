#!/usr/bin/env node
/**
 * Cross-platform env wrapper (Unix `env -u` / `VAR=value cmd` and Windows).
 * Tokens without `=` are unset; tokens with `=` are set.
 * Then runs the remaining command.
 *
 * Usage: node run-unset-env.mjs [VAR | VAR=value]... -- command [args...]
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export function applyEnvMutations(env, tokens) {
  const next = { ...env }
  for (const token of tokens) {
    const eq = token.indexOf('=')
    if (eq === -1) {
      delete next[token]
      continue
    }
    next[token.slice(0, eq)] = token.slice(eq + 1)
  }
  return next
}

function main() {
  const argv = process.argv.slice(2)
  const sep = argv.indexOf('--')
  if (sep <= 0 || sep === argv.length - 1) {
    console.error(
      'Usage: node run-unset-env.mjs [VAR | VAR=value]... -- command [args...]',
    )
    process.exit(1)
  }

  const env = applyEnvMutations(process.env, argv.slice(0, sep))
  const [command, ...args] = argv.slice(sep + 1)

  const child = spawn([command, ...args].join(' '), {
    env,
    stdio: 'inherit',
    shell: true,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 1)
  })
}

const invokedAsCli =
  process.argv[1] !== undefined &&
  path.normalize(path.resolve(process.argv[1])) ===
    path.normalize(fileURLToPath(import.meta.url))

if (invokedAsCli) {
  main()
}
