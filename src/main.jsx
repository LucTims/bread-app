import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Check if running inside Capacitor native Android/iOS shell
const isNativeApp = Boolean(
  window.Capacitor?.isNativePlatform?.() ||
  window.Capacitor?.getPlatform?.() === 'android' ||
  window.Capacitor?.getPlatform?.() === 'ios' ||
  window.location.protocol === 'capacitor:' ||
  (typeof navigator !== 'undefined' && navigator.userAgent.includes('wv'))
);

if (isNativeApp) {
  // In native Android WebView, assets are already bundled locally inside the APK.
  // Service Workers must NOT be active because they cache stale bundles between APK updates.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key);
      }
    });
  }
} else {
  // Register service worker for offline support & PWA install ONLY in standard web browsers
  const updateSW = registerSW({
    onNeedRefresh() {
      updateSW(true);
    },
    onOfflineReady() {
      console.log('✅ BoomRead est prêt pour une utilisation hors-ligne !');
    },
  });
}

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

// Failsafe: Guarantee splash screen is removed after 2.5s even if an edge case occurs
setTimeout(dismissSplash, 2500);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App onReady={dismissSplash} />
  </StrictMode>,
)
