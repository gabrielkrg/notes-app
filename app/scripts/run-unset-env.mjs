#!/usr/bin/env node
/**
 * Cross-platform replacement for `env -u VAR cmd ...`.
 * Deletes the named env var(s), then runs the remaining command.
 *
 * Usage: node run-unset-env.mjs VAR [VAR...] -- command [args...]
 */
import { spawn } from 'node:child_process'

const argv = process.argv.slice(2)
const sep = argv.indexOf('--')
if (sep <= 0 || sep === argv.length - 1) {
  console.error(
    'Usage: node run-unset-env.mjs VAR [VAR...] -- command [args...]',
  )
  process.exit(1)
}

const envNames = argv.slice(0, sep)
const [command, ...args] = argv.slice(sep + 1)
const env = { ...process.env }
for (const name of envNames) {
  delete env[name]
}

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
