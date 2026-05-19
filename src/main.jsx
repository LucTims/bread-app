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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
