# Project: BoomRead PWA Offline Reliability

## Architecture
- **PWA & SW Cache**: Vite PWA plugin with Workbox caching app shell, assets, fonts, covers, and API responses.
- **Connectivity Detection**: `src/lib/connectivity.js` module & `useOnlineStatus` hook combining `navigator.onLine` with active reachability probing (short timeout fetch ping).
- **Offline Data Storage**: `src/lib/offlineStore.js` managing 4 `localforage` IndexedDB stores (`offline_books`, `book_meta`, `offline_covers`, `sync_queue`) + fast synchronous `localStorage` indexes (`bread_book_index`, `bread_progress_index`).
- **Auth Resilience**: `src/lib/AuthContext.jsx` loading cached user session instantly when real connectivity is unavailable.
- **Reader & TTS**: `src/pages/Reader.jsx` rendering offline PDF blobs via `react-pdf` and handling native browser `SpeechSynthesis` TTS fallback.
- **Background Sync**: `sync_queue` background flush with exponential backoff and retry when real connectivity is restored.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Connectivity Detection System (R2) | Reachability prober & hook replacing raw `navigator.onLine` | None | DONE |
| 2 | Offline-First Shell & PWA SW (R1) | App shell precaching, SW fallback & fast load | M1 | DONE |
| 3 | Offline-First Data & Auth (R3) | Cached session bypass & offline-first data loading | M1 | DONE |
| 4 | Offline Reading & Native TTS (R4) | IndexedDB PDF rendering & SpeechSynthesis fallback | M1, M3 | DONE |
| 5 | Intelligent Background Sync (R5) | Non-blocking queued stats sync & retry strategy | M1, M3 | DONE |
| 6 | E2E Testing & Final Verification | Test infra, Tier 1-4 test suite, Tier 5 hardening | M1-M5 | DONE |

## Interface Contracts

### `src/lib/connectivity.js`
- `checkRealConnectivity(options?: { timeoutMs?: number }): Promise<boolean>`
- `isRealOnline(): boolean` (synchronous status estimate based on last probe)
- `subscribeConnectivity(callback: (status: { isOnline: boolean, isPhantom: boolean, isOffline: boolean }) => void): () => void`
- Custom window event: `'connectivity-changed'` with `detail: { isOnline, isPhantom, isOffline }`

### `src/lib/useOnlineStatus.js`
- React hook returning `{ isOnline: boolean, isPhantom: boolean, isOffline: boolean, checkNow: () => Promise<boolean> }`

### `src/lib/AuthContext.jsx`
- `useAuth()` providing `{ user, profile, loading, isOffline, logout }`
- Resolves `loading = false` immediately using cached session when offline or phantom network detected.

### `src/lib/offlineStore.js`
- `enqueueReadingStats(stats)`
- `flushSyncQueue(supabaseClient)` with retry resilience and partial failure isolation.

## Code Layout
- `src/lib/connectivity.js` (NEW) — Real connectivity probe engine
- `src/lib/useOnlineStatus.js` (NEW) — React hook for reactive connectivity status
- `src/lib/offlineStore.js` — IndexedDB & localStorage store functions
- `src/lib/AuthContext.jsx` — Resilient auth provider
- `src/App.jsx` — Main router & background sync listener
- `src/pages/Reader.jsx` — PDF reader & native TTS engine
- `src/pages/Home.jsx` & `src/pages/Library.jsx` — Offline-first library views
- `vite.config.js` — Service worker precache & runtime caching rules
