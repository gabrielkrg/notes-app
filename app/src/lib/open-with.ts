import { pathToFileURL } from 'node:url'

export type OpenWithLaunch =
  | { kind: 'spawn'; command: string; args: string[] }
  | { kind: 'openPath' }

export function openWithLaunches(platform: string, file: string): OpenWithLaunch[] {
  if (platform === 'win32') {
    return [
      { kind: 'spawn', command: 'rundll32.exe', args: ['shell32.dll,OpenAs_RunDLL', file] },
      { kind: 'openPath' },
    ]
  }

  if (platform === 'darwin') {
    return [{ kind: 'openPath' }]
  }

  const uri = pathToFileURL(file).href
  return [
    { kind: 'spawn', command: 'kioclient', args: ['openWith', uri] },
    { kind: 'spawn', command: 'kioclient5', args: ['openWith', uri] },
    {
      kind: 'spawn',
      command: 'gdbus',
      args: [
        'call',
        '--session',
        '--dest',
        'org.freedesktop.portal.Desktop',
        '--object-path',
        '/org/freedesktop/portal/desktop',
        '--method',
        'org.freedesktop.portal.OpenURI.OpenURI',
        '',
        uri,
        "{'ask': <true>}",
      ],
    },
    { kind: 'openPath' },
  ]
}
