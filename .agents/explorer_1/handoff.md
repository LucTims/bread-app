# Explorer 1 Handoff Report — BoomRead PWA Baseline Architecture

## 1. Observation

### Key File Locations & Specific Line Details
- **PWA & SW Configuration**: `vite.config.js` (lines 9-112), `src/main.jsx` (lines 8-16), `index.html` (lines 17-101), `public/sw-push.js` (lines 4-57).
  - `vite.config.js`: `registerType: 'autoUpdate'`, `navigateFallback: '/index.html'`, `maximumFileSizeToCacheInBytes: 5242880`. Runtime caching configured for Google Fonts (CacheFirst), Supabase Covers (CacheFirst, 200 entries, 30 days maxAge), Supabase Storage Assets (NetworkFirst, 10s timeout), Supabase API (NetworkFirst, 5s timeout), Material Symbols (CacheFirst).
  - `src/main.jsx`: `registerSW({ onNeedRefresh, onOfflineReady })` dismisses HTML splash screen via `dismissSplash()`.
  - `index.html`: Pre-renders splash screen HTML (`#splash-screen`) and attaches pre-hydration listeners for `beforeinstallprompt` and `appinstalled`.
- **Connectivity Detection**: `src/App.jsx` (lines 28, 31-52), `src/lib/AuthContext.jsx` (line 77), `src/pages/Home.jsx` (line 12), `src/pages/Library.jsx` (lines 29, 45), `src/pages/Reader.jsx` (lines 90, 161, 240).
  - Code relies exclusively on `navigator.onLine` and `window.addEventListener('online'/'offline')`.
  - No active reachability probing or fetch ping exists to verify true server reachability.
- **Offline Data & Storage**: `src/lib/offlineStore.js` (lines 4-26, 31-32, 68-77, 91-110, 145-176, 234-248, 324-348).
  - Four localforage IndexedDB stores: `offline_books` (PDF Blobs), `book_meta` (meta & progress), `offline_covers` (cover Blobs), `sync_queue` (deferred stats).
  - Two fast localStorage indexes: `bread_book_index` and `bread_progress_index`.
- **Auth & Session Persistence**: `src/lib/AuthContext.jsx` (lines 8-47, 77-134).
  - Stores cached user & profile in `bread_cached_user` and `bread_cached_profile`.
  - Line 77 checks `if (!navigator.onLine)` to return cached session. If `navigator.onLine` is true, calls `supabase.auth.getSession()`.
- **Offline Reader & TTS**: `src/pages/Reader.jsx` (lines 147-219, 236-272, 374-437, 729-762).
  - Document loaded from IndexedDB Blob via `URL.createObjectURL(blob)`.
  - Text-to-speech supports native SpeechSynthesis API (offline) and ElevenLabs API (online only).
- **Background Sync**: `src/lib/offlineStore.js` (lines 324-348), `src/App.jsx` (lines 31-42).
  - Stat items queued to `sync_queue` store and flushed during window `'online'` event.
- **Build System & Dependencies**: `package.json` (lines 6-32).
  - Build tool: Vite (`npm run dev`, `npm run build`).
  - No testing framework (Vitest, Jest, Playwright) or test scripts exist in `package.json`.

---

## 2. Logic Chain

1. **App Shell & Routing**: `vite.config.js` sets `navigateFallback: '/index.html'`, which instructs Workbox to serve cached `index.html` for all navigation routes when offline. `index.html` contains an inline splash screen that displays before JS bundle loads.
2. **The Phantom Connectivity Defect**:
   - `navigator.onLine` evaluates to `true` whenever a network interface is active.
   - When mobile data or WiFi has no actual internet connection, `navigator.onLine` returns `true`.
   - In `AuthContext.jsx` line 77, `if (!navigator.onLine)` evaluates to false. The app skips cached offline login bypass and executes `supabase.auth.getSession()`.
   - In `App.jsx` line 55, `if (isOffline)` evaluates to false, forcing `ProtectedRoute` to wait on `loading` or attempt network redirection to `/login`.
   - This causes the app shell to freeze or hang under phantom connectivity instead of displaying cached offline data immediately.
3. **Data Hydration Strategy**: `offlineStore.js` provides synchronous getters (`getOfflineBooksSync`, `getProgressMapSync`) that read from `localStorage` in <5ms. `Home.jsx` and `Library.jsx` utilize these for instant rendering in offline mode, but rely on `navigator.onLine` to decide whether to trigger network fetches.
4. **Background Sync Reliability**: Syncing relies strictly on the window `'online'` event. Under intermittent connection or failed RPC calls, there is no automatic retry loop or exponential backoff strategy.

---

## 3. Caveats

- **Network Environment**: Investigation was conducted via static code analysis. Live HTTP traffic under actual phantom connectivity was not mocked via network proxy, but simulated logically through DevTools throttling model.
- **No Existing Test Suite**: There are no existing automated tests in the repository to run for baseline regression check.

---

## 4. Conclusion

The BoomRead codebase possesses a solid foundation for offline operation: IndexedDB storage via `localforage`, fast `localStorage` index caches, native `SpeechSynthesis` TTS, and Workbox PWA caching rules. However, its offline reliability is severely compromised by its single point of failure: **exclusive reliance on `navigator.onLine`**. 

To achieve true offline-first reliability, the application requires:
1. A robust **Real Connectivity Detector** combining `navigator.onLine` with lightweight ping probing.
2. An **Offline-First Data Strategy** across all views (Home, Library, Profile) that always loads local cache first before attempting network updates.
3. **Auth Resilience** that allows cached sessions to bypass network checks when ping probing fails.
4. **Background Sync Retry Logic** for `sync_queue`.

---

## 5. Verification Method

To verify these observations independently:
1. **Inspect Configuration**: View `vite.config.js` and `src/lib/offlineStore.js`.
2. **Simulate Phantom Connectivity**:
   - Run `npm run dev` to start dev server.
   - Open Chrome DevTools -> Application -> Service Workers (verify SW registration).
   - Go to Network tab -> set throttling to custom offline or block request domain `ezmchxokfeybpccmkhyx.supabase.co` while keeping `navigator.onLine` true (e.g. Request Blocking).
   - Observe app behavior on reload to verify `supabase.auth.getSession()` network waiting behavior.
