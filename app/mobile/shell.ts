import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/**
 * Android draws the WebView edge-to-edge, under the status bar and the gesture
 * bar. The `.capacitor` class turns on the `env(safe-area-inset-*)` padding in
 * `styles.css` so the title bar clears the system icons instead of sitting
 * beneath them.
 */
export function installMobileShell(): void {
  document.documentElement.classList.add('capacitor')
  if (!Capacitor.isNativePlatform()) return

  // Keep the app under the bars and let CSS do the insetting; the status bar
  // itself stays transparent so the title bar's background shows through.
  void StatusBar.setOverlaysWebView({ overlay: true })

  syncStatusBarStyle()
  new MutationObserver(syncStatusBarStyle).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
}

/** Status bar icons follow the app's own light/dark theme. */
function syncStatusBarStyle(): void {
  const dark = document.documentElement.classList.contains('dark')
  // `Style.Dark` means light icons for a dark background, and vice versa.
  void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
}
