# Code Changes Summary — Milestone 1: Real Connectivity Detection System (R2)

## Files Created / Modified

### 1. `src/lib/connectivity.js` (Created/Updated)
- **Active HTTP Probe**: Performs `fetch('/favicon.svg?_t=' + Date.now(), { method: 'HEAD', cache: 'no-store' })` with 2500ms `AbortController` timeout.
- **3-State Classification**:
  - **Online**: `{ isOnline: true, isOffline: false, isPhantom: false }`
  - **Offline**: `{ isOnline: false, isOffline: true, isPhantom: false }`
  - **Phantom**: `{ isOnline: false, isOffline: true, isPhantom: true }` (Note: both Offline and Phantom set `isOffline: true` for unified fallback).
- **Event Dispatch**: Emits `connectivity-changed` CustomEvent on window and notifies subscribers.
- **Visibility Awareness**: Pauses 5-second interval probing when `document.visibilityState === 'hidden'`; resumes probing on focus or visibility change.

### 2. `src/lib/useOnlineStatus.js` (Created/Updated)
- **React Hook**: Returns `{ isOnline, isOffline, isPhantom, lastChecked, checkNow }`.
- Subscribes to `connectivity.js` updates and runs a freshness check on mount.

### 3. `src/App.jsx` (Refactored)
- Replaced `const [isOffline, setIsOffline] = useState(!navigator.onLine)` and window event listeners in `ProtectedRoute` with `const { isOffline, isOnline } = useOnlineStatus()`.
- Flushes offline reading stats queue when transitioning from offline to online.

### 4. `src/components/TopBar.jsx` (Refactored)
- Replaced `if (user && navigator.onLine)` streak fetch with `if (user && isOnline)` using `useOnlineStatus()`.

### 5. `src/lib/AuthContext.jsx` (Refactored)
- Replaced `if (!navigator.onLine)` in `init()` with `const connStatus = await checkRealConnectivity(); if (connStatus.isOffline)`.

### 6. `src/pages/AIChat.jsx` (Refactored)
- `fetchOnlineBooks` useEffect uses `isOnline` from `useOnlineStatus()`.
- `sendMessage` uses `const connStatus = await checkRealConnectivity(); if (connStatus.isOffline)`.

### 7. `src/pages/Home.jsx` (Refactored)
- Replaced `const isOffline = !navigator.onLine;` with `useOnlineStatus()`.
- Updated `loadData` callback and dependencies to use reactive `isOffline`.

### 8. `src/pages/Library.jsx` (Refactored)
- Replaced `const isOfflineNow = !navigator.onLine` and `isOfflineMode` ref / `window` event listeners with `useOnlineStatus()`.
- `isOfflineMode.current` ref is synced with `isOfflineNow`.

### 9. `src/pages/Reader.jsx` (Refactored)
- Replaced `navigator.onLine` checks in `sendReadingStats`, `loadBook`, and `init` useEffect with `await checkRealConnectivity()`.
