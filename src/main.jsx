import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Register service worker for offline support & PWA install
const updateSW = registerSW({
  onNeedRefresh() {
    // New version available — auto-update
    updateSW(true)
  },
  onOfflineReady() {
    console.log('✅ BRead est prêt pour une utilisation hors-ligne !')
  },
})

// ── Dismiss splash screen once React renders ──
function dismissSplash() {
  const splash = document.getElementById('splash-screen')
  if (splash) {
    // Small delay to let the first paint settle
    requestAnimationFrame(() => {
      splash.classList.add('hide')
      // Remove from DOM after fade-out animation
      setTimeout(() => splash.remove(), 500)
    })
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App onReady={dismissSplash} />
  </StrictMode>,
)
