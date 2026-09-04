import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'dev.notes.mobile',
  appName: 'Notes',
  webDir: 'dist-mobile',
  android: {
    // The WebView needs a normal http(s) origin for `fetch` to reach GitHub.
    allowMixedContent: false,
  },
}

export default config
