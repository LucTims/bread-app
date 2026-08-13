# Handoff Report: Milestone 1 - Real Connectivity Detection System (R2)

## 1. Observation

A full codebase search was conducted using `grep_search` across `c:\Users\helpdesk\Desktop\bread-app\src`. Exactly 13 direct references to `navigator.onLine` were identified:

1. `src/App.jsx:28` — `const [isOffline, setIsOffline] = useState(!navigator.onLine);`
2. `src/components/TopBar.jsx:16` — `if (user && navigator.onLine)`
3. `src/lib/AuthContext.jsx:77` — `if (!navigator.onLine)`
4. `src/pages/AIChat.jsx:25` — `if (!user || !navigator.onLine) return;`
5. `src/pages/AIChat.jsx:116` — `if (!navigator.onLine)`
6. `src/pages/Home.jsx:12` — `const isOffline = !navigator.onLine;`
7. `src/pages/Home.jsx:58` — `if (!navigator.onLine)`
8. `src/pages/Library.jsx:29` — `const isOfflineNow = !navigator.onLine;`
9. `src/pages/Library.jsx:45` — `const isOfflineMode = useRef(!navigator.onLine);`
10. `src/pages/Library.jsx:76` — `if (!navigator.onLine)`
11. `src/pages/Reader.jsx:90` — `if (!navigator.onLine)`
12. `src/pages/Reader.jsx:161` — `if (!navigator.onLine)`
13. `src/pages/Reader.jsx:240` — `if (!navigator.onLine)`

Existing static asset check:
- File `public/favicon.svg` exists at path `c:\Users\helpdesk\Desktop\bread-app\public\favicon.svg` (size: 9522 bytes), confirming the availability of a fast, lightweight endpoint for active probing.

## 2. Logic Chain

1. **Observation 1**: All 13 occurrences in `src/` rely solely on browser `navigator.onLine`.
2. **Reasoning**: `navigator.onLine` checks local network adapter state only. When a cellular network or WiFi router is connected without internet access (phantom connectivity), `navigator.onLine` evaluates to `true`.
3. **Observation 3**: In `src/lib/AuthContext.jsx:77`, `if (!navigator.onLine)` evaluates to `false` during phantom connectivity, bypassing local cached authentication and executing `supabase.auth.getSession()`, which hangs indefinitely or times out slowly.
4. **Conclusion**: Introducing `src/lib/connectivity.js` with active HTTP reachability probing to `/favicon.svg` (2500ms timeout, cache busting `?_t=${Date.now()}`) and wrapping it with `useOnlineStatus` hook allows distinguishing:
   - Truly Online: `isOnline: true`, `isOffline: false`, `isPhantom: false`
   - Truly Offline: `isOnline: false`, `isOffline: true`, `isPhantom: false`
   - Phantom Connectivity: `isOnline: false`, `isOffline: true`, `isPhantom: true`
5. Both Truly Offline and Phantom Connectivity evaluate `isOffline: true`, ensuring seamless local fallback across all 13 locations.

## 3. Caveats

- **Service Worker Interception**: In PWA environments, service workers must not cache `/favicon.svg?_t=...` network requests. Setting `cache: 'no-store'` in fetch options and dynamic query parameters ensures probe bypasses service worker caches.
- **Server Load**: Periodic 5-second interval probing only occurs when the tab is active/focused. When the window is hidden (`document.visibilityState === 'hidden'`), background probing should pause to conserve battery and data usage.

## 4. Conclusion

The technical design specification for Milestone 1 (R2) is fully documented in `.agents/explorer_m1/analysis.md`. The design provides:
1. `src/lib/connectivity.js` for core state & active probing.
2. `src/lib/useOnlineStatus.js` React hook for reactive UI updates.
3. Detailed refactoring mapping for all 13 locations in `src/`.

The system is ready for implementation by Implementer M1.

## 5. Verification Method

1. **Static Analysis**: Verify all 13 listed locations in `src/` are refactored to import `useOnlineStatus` or `checkRealConnectivity`.
2. **Build Verification**: Run `npm run build` or `npx vite build` to ensure error-free compilation.
3. **Phantom Connection Test**:
   - Open DevTools Network tab.
   - Keep network Online (`navigator.onLine === true`), but block requests to `/favicon.svg*` or external APIs.
   - Verify `getConnectivityStatus()` returns `{ isOnline: false, isOffline: true, isPhantom: true }`.
   - Verify app immediately loads cached data from IndexedDB/localStorage without hanging.
