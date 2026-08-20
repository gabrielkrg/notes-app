import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { openWithLaunches } from './open-with.ts'

describe('openWithLaunches', () => {
  it('opens Linux notes with the system app chooser', () => {
    const launches = openWithLaunches('linux', '/home/me/notes/reactivity.md')

    assert.deepEqual(launches[0], {
      kind: 'spawn',
      command: 'kioclient',
      args: ['openWith', 'file:///home/me/notes/reactivity.md'],
    })
    assert.equal(launches.at(-1)?.kind, 'openPath')

    const portal = launches.find(
      (launch) => launch.kind === 'spawn' && launch.command === 'gdbus',
    )
    assert.ok(portal && portal.kind === 'spawn')
    assert.deepEqual(portal.args, [
      'call',
      '--session',
      '--dest',
      'org.freedesktop.portal.Desktop',
      '--object-path',
      '/org/freedesktop/portal/desktop',
      '--method',
      'org.freedesktop.portal.OpenURI.OpenURI',
      '',
      'file:///home/me/notes/reactivity.md',
      "{'ask': <true>}",
    ])
  })

  it('opens Windows notes with the Open with dialog', () => {
    assert.deepEqual(openWithLaunches('win32', 'C:\\notes\\reactivity.md')[0], {
      kind: 'spawn',
      command: 'rundll32.exe',
      args: ['shell32.dll,OpenAs_RunDLL', 'C:\\notes\\reactivity.md'],
    })
  })

  it('falls back to the default app on macOS', () => {
    assert.deepEqual(openWithLaunches('darwin', '/Users/me/notes/reactivity.md'), [
      { kind: 'openPath' },
    ])
  })

  it('encodes spaces in file URLs', () => {
    const launches = openWithLaunches('linux', '/home/me/my notes/a file.md')
    assert.equal(launches[0]?.kind, 'spawn')
    if (launches[0]?.kind !== 'spawn') return
    assert.equal(launches[0].args[1], 'file:///home/me/my%20notes/a%20file.md')
  })
})
