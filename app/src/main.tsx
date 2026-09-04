import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root was not found')

function mount() {
  createRoot(root!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// The mobile build installs its own `window.desktop` before React mounts, so
// `isDesktop()` is already true on the first render. The import is dynamic so
// the Capacitor plugins never reach the web or Electron bundles.
if (import.meta.env.VITE_PLATFORM === 'mobile') {
  void import('../mobile/api.ts').then(({ installMobileApi }) => {
    installMobileApi()
    mount()
  })
} else {
  mount()
}
