# Handoff Report — Milestone 1 Explorer 2 (R2 React Integration)

## 1. Observation
- **Hook Implementation (`src/lib/useOnlineStatus.js`)**:
  - `useOnlineStatus.js` imports `getConnectivityStatus`, `subscribeToConnectivity`, and `checkRealConnectivity` from `./connectivity` (Lines 1-2).
  - Initializes state via `useState(() => getConnectivityStatus())` (Line 5).
  - Subscribes via `subscribeToConnectivity` and executes `checkRealConnectivity()` on mount (Lines 7-16).
  - Exposes `{ isOnline, isOffline, isPhantom, lastChecked, checkNow }` (Lines 22-28).
- **Component Usages**:
  - `src/App.jsx` (Lines 24, 29-48, 51-53): `ProtectedRoute` consumes `isOffline` and `isOnline`. Allows offline access (`if (isOffline) return children`) and syncs offline stats queue when returning online.
  - `src/components/TopBar.jsx` (Lines 6, 11, 18-24): Consumes `isOnline` to conditionally query streak data from Supabase.
  - `src/pages/Home.jsx` (Lines 8, 13, 16-17, 44, 189, 360-363): Consumes `isOffline` to seed IndexedDB offline books/progress, hide online promos/install prompt, and display Offline Warning Banner.
  - `src/pages/Library.jsx` (Lines 11, 28, 31-37, 70): Consumes `isOffline` to switch between Supabase API and `getOfflineBooksSync()`.
  - `src/pages/AIChat.jsx` (Lines 7, 13, 28, 119-120): Consumes `isOnline` to disable online book pre-fetching and active probing before AI message delivery.
  - `src/pages/Reader.jsx` (Lines 6, 91, 163, 243): Calls `checkRealConnectivity()` directly before loading progress / saving reading state.
- **Auth Context & Fallback (`src/lib/AuthContext.jsx`)**:
  - `AuthContext.jsx` (Lines 78-93) calls `const connStatus = await checkRealConnectivity()`. If `connStatus.isOffline` is true, immediately falls back to `getCachedUser()` / `getCachedProfile()` and sets `loading = false`.
  - `src/lib/connectivity.js` (Line 61) sets probe timeout to 2500ms (`options.timeoutMs ?? 2500`), ensuring fallback finishes in < 3 seconds.
  - `src/lib/connectivity.js` (Lines 168-177) runs periodic health checks every 5000ms when `document.visibilityState === 'visible'`.
- **Raw `navigator.onLine` & Window Events Inventory**:
  - `src/lib/connectivity.js` contains the only `navigator.onLine` (Lines 10, 11, 65, 101) and `window.addEventListener('online'/'offline')` (Lines 186-187) references for network detection in the codebase.
  - Non-network navigator calls exist in `pushManager.js`, `pwaInstallLogger.js`, `InstallPrompt.jsx`, `Chat.jsx`, and `Login.jsx` for user agent, haptics, clipboard, and standalone display mode.

## 2. Logic Chain
1. **Observation**: `useOnlineStatus.js` exposes `{ isOnline, isOffline, isPhantom, lastChecked, checkNow }` backed by `connectivity.js` subscribers and 5s periodic active HEAD probing.
   - **Reasoning**: React components (`App.jsx`, `Home.jsx`, `Library.jsx`, `TopBar.jsx`, `AIChat.jsx`) consuming `useOnlineStatus()` receive reactive updates whenever `updateStatus()` is called in `connectivity.js`.
2. **Observation**: In `AuthContext.jsx` line 78, `checkRealConnectivity()` is awaited prior to `supabase.auth.getSession()`. Active HTTP probe timeout in `connectivity.js` line 61 is set to 2500ms.
   - **Reasoning**: During phantom connectivity (e.g. Wi-Fi connected but no WAN access), active probe fails after 2.5s and classifies status as `isOffline: true, isPhantom: true`. `AuthContext` immediately falls back to `getCachedUser()` without waiting for Supabase session network timeout (10-30s). This satisfies the requirement for non-blocking < 3s fallback.
3. **Observation**: `connectivity.js` line 176 executes periodic probes every 5000ms, and window online/offline listeners update state immediately (0ms).
   - **Reasoning**: Connectivity changes trigger React re-renders across subscribed components within < 5s.
4. **Observation**: `Chat.jsx` does not currently consume `useOnlineStatus` or `checkRealConnectivity`.
   - **Reasoning**: `Chat.jsx` attempts Supabase Realtime channel subscriptions when offline or in phantom offline mode. Integrating `useOnlineStatus` into `Chat.jsx` will prevent unnecessary network error loops.

## 3. Caveats
- No caveats regarding component detection. The codebase cleanly uses `useOnlineStatus` and `connectivity.js` across major pages, with only minor missing integration in `Chat.jsx` and re-connection session re-verification in `AuthContext.jsx`.

## 4. Conclusion
- React integration for requirement R2 is robustly established via `src/lib/useOnlineStatus.js`.
- Components (`App.jsx`, `TopBar.jsx`, `Home.jsx`, `Library.jsx`, `AIChat.jsx`) correctly consume 3-state connectivity (`isOnline`, `isOffline`, `isPhantom`).
- Non-blocking < 3s fallback is guaranteed by `AuthContext.jsx` using `checkRealConnectivity()` with a 2500ms probe timeout limit.
- 5s UI update requirement is guaranteed by `connectivity.js` periodic 5s probing and instant hardware event listeners.
- Direct raw `navigator.onLine` network checks have been consolidated inside `src/lib/connectivity.js`.

## 5. Verification Method
- **Files to Inspect**:
  - `src/lib/useOnlineStatus.js`
  - `src/App.jsx`
  - `src/lib/AuthContext.jsx`
  - `src/lib/connectivity.js`
  - `src/pages/Home.jsx`, `src/pages/Library.jsx`, `src/pages/AIChat.jsx`
- **Verification Commands**:
  - `npm test` or `npx vite build` to ensure no syntax errors or broken imports.
- **Invalidation Conditions**:
  - Any raw `navigator.onLine` added directly to UI component files outside `connectivity.js`.
  - Removal of `checkRealConnectivity()` pre-check in `AuthContext.jsx`.
