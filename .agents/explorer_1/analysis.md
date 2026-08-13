# BoomRead PWA Baseline Architecture & Offline Reliability Analysis

## Executive Summary
This document presents the detailed architectural baseline analysis for the BoomRead PWA application (`c:\Users\helpdesk\Desktop\bread-app`). The primary objective of the offline reliability initiative is to transform BoomRead into a true **offline-first PWA**, ensuring that the app shell, library, cached user session, and downloaded reader experience function flawlessly without network access or during phantom connectivity (mobile data/WiFi enabled without internet access).

---

## 1. PWA & Service Worker Configuration

### 1.1 Plugin & Build Configuration (`vite.config.js`)
- **Plugin**: `vite-plugin-pwa` (v1.3.0) using Workbox (`registerType: 'autoUpdate'`).
- **Static Asset Precaching**: Explicitly includes `favicon.svg`, `icons.svg`, `icon-192.png`, `icon-512.png`.
- **Precache Size Limit**: `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` (5MB) to accommodate larger JS/WASM bundles (e.g. PDF.js worker).
- **Navigation Fallback**: `navigateFallback: '/index.html'` with denylist `/^\/api/`, ensuring SPA client-side routing falls back to cached `index.html`.
- **Custom Scripts**: `importScripts: ['sw-push.js']` injected into service worker for Web Push capabilities.

### 1.2 Workbox Runtime Caching Rules
| Route / URL Pattern | Workbox Handler | Cache Name | Expiration / Options |
| --- | --- | --- | --- |
| `^https://fonts.googleapis.com/.*` | `CacheFirst` | `google-fonts-cache` | 10 entries, 1 year |
| `^https://fonts.gstatic.com/.*` | `CacheFirst` | `gstatic-fonts-cache` | 20 entries, 1 year, statuses `[0, 200]` |
| `^https://...supabase.co/storage/.*\.(jpg\|jpeg\|png\|gif\|webp\|svg)` | `CacheFirst` | `supabase-covers-cache` | 200 entries, 30 days, statuses `[0, 200]` |
| `^https://...supabase.co/storage/.*` | `NetworkFirst` | `supabase-storage-cache` | 50 entries, 7 days, `networkTimeoutSeconds: 10` |
| `^https://...supabase.co/(auth\|rest)/.*` | `NetworkFirst` | `supabase-api-cache` | 30 entries, 24 hours, `networkTimeoutSeconds: 5` |
| `^https://fonts.googleapis.com/css2\?family=Material\+Symbols.*` | `CacheFirst` | `material-icons-cache` | 5 entries, 1 year |

### 1.3 Service Worker Registration (`src/main.jsx`)
- Uses `registerSW` from `virtual:pwa-register`.
- `onNeedRefresh`: Automatically triggers `updateSW(true)` for instant client updates.
- `onOfflineReady`: Logs confirmation to console.
- Dismisses the HTML splash screen (`dismissSplash()`) via `requestAnimationFrame` once React DOM mount completes.

### 1.4 HTML Shell & Splash Screen (`index.html`)
- Pre-rendered CSS/HTML splash screen (`#splash-screen`) ensures instant visual feedback before JS bundle execution.
- Captures PWA installation events prior to React hydration:
  - Listens for `beforeinstallprompt`, stores event on `window.deferredPrompt`, and dispatches `app-installable`.
  - Listens for `appinstalled`, sets `localStorage.setItem('pwa_just_installed', 'true')`.

### 1.5 Push Notification Worker (`public/sw-push.js`)
- Handles incoming `push` events, formats options, and calls `registration.showNotification`.
- Handles `notificationclick` events, focusing existing window or opening `/notifications`.

---

## 2. Connectivity Detection Architecture

### 2.1 Current Implementation (`src/App.jsx`)
- Component state: `const [isOffline, setIsOffline] = useState(!navigator.onLine)`.
- Event listeners attached to `window`:
  - `window.addEventListener('online', handleOnline)`
  - `window.addEventListener('offline', handleOffline)`

### 2.2 Global References to `navigator.onLine`
There are 13 occurrences across 7 files:
1. `src/App.jsx` (Line 28): ProtectedRoute state initialization.
2. `src/components/TopBar.jsx` (Line 16): Online sync trigger for user profile.
3. `src/lib/AuthContext.jsx` (Line 77): Offline login session fallback check.
4. `src/pages/AIChat.jsx` (Lines 25, 116): Disables AI chat when offline.
5. `src/pages/Home.jsx` (Lines 12, 58): Initial state and offline banner logic.
6. `src/pages/Library.jsx` (Lines 29, 45, 76): Sync data pre-fill and download check.
7. `src/pages/Reader.jsx` (Lines 90, 161, 240): Stat queuing and book loading fallback.

### 2.3 Core Defect: Phantom Connectivity Vulnerability
- `navigator.onLine` only checks browser network interface status (e.g. cellular modem or WiFi interface enabled).
- It returns `true` when connected to a router/tower even if there is zero cellular data reception, captive portal, or server outage ("phantom connectivity").
- Impact:
  - `AuthContext` skips offline cached session loading and attempts `supabase.auth.getSession()`, hanging until fetch timeout.
  - `ProtectedRoute` fails to bypass auth check because `isOffline` remains `false`.
  - `Library` and `Home` attempt Supabase REST calls, displaying loading spinners or error toasts.

---

## 3. Offline Data & Storage Architecture

### 3.1 IndexedDB Storage Engine (`src/lib/offlineStore.js`)
Managed via `localforage` (Database Name: `bread-app`) with 4 dedicated object stores:
1. `offline_books`: PDF File Blobs (Key format: `pdf_${bookId}`).
2. `book_meta`: Book metadata (Key format: `meta_${bookId}`) & reading progress (Key format: `progress_${bookId}`).
3. `offline_covers`: Book cover Image Blobs (Key format: `cover_${bookId}`).
4. `sync_queue`: Queued offline reading statistics (Key format: `stats_${timestamp}_${random}`).

### 3.2 Fast Synchronous localStorage Indexes
Designed for sub-5ms instant rendering before IndexedDB async hydration:
- `bread_book_index`: Array of cached book entries `[{id, title, author, cover_url, sizeBytes, downloadedAt}]`.
- `bread_progress_index`: Map of reading progress `{bookId: {currentPage, totalPages, lastReadAt}}`.

### 3.3 Memory Caching & Object URLs
- `_metaCache`: In-memory `Map` holding metadata for active books.
- `_coverUrlCache`: In-memory dictionary holding blob object URLs created via `URL.createObjectURL(blob)`.

---

## 4. Auth & Session Persistence (`src/lib/AuthContext.jsx`)

### 4.1 Local Storage Session Caching Keys
- `bread_cached_user`: Stores minimal user object `{id, email}`.
- `bread_cached_profile`: Stores profile object `{id, email, role, created_at}`.

### 4.2 Auth Lifecycle Flow
1. **Offline Mode (`!navigator.onLine`)**:
   - Reads `getCachedUser()` and `getCachedProfile()`.
   - If user exists, populates context state and sets `loading(false)` immediately without querying Supabase.
2. **Online Mode (`navigator.onLine === true`)**:
   - Pre-fills UI state with cached user for immediate rendering.
   - Calls `supabase.auth.getSession()` over the network.
   - On success: updates cache via `cacheUserSession()`.
   - On network failure: retains cached user if available.

---

## 5. Offline Reader & TTS Engine (`src/pages/Reader.jsx`)

### 5.1 PDF Document Loading
- Checks IndexedDB via `getOfflineBook(bookId)`.
- If cached blob exists, generates Object URL (`URL.createObjectURL(blob)`) and loads via `react-pdf` (`<Document file={pdfFile} />`).
- If not cached:
  - In offline mode: Displays error message ("Ce livre n'est pas téléchargé").
  - In online mode: Fetches PDF from Supabase Storage (`books` bucket), downloads Blob, and automatically saves to IndexedDB (`saveBookOffline`) & caches cover (`saveCoverOffline`).

### 5.2 Reading State Persistence
- Progress restored on load via `getReadingProgress(bookId)`.
- On page turn: Updates `pageNumber`, writes to IndexedDB and localStorage index via `saveReadingProgress(bookId, newPage, numPages)`.
- Increments `localPagesReadRef.current` for reading stats tracking.

### 5.3 TTS Engine: Native vs Cloud Fallback
- **Browser Native SpeechSynthesis API**: Works 100% offline. Parses page text into sentences (`splitSentences`), speaks using browser voices (filtered for French `fr`), auto-advances pages.
- **ElevenLabs API (`src/lib/elevenLabs.js`)**: Requires active internet connection. POSTs text to `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`. Requires fallback to SpeechSynthesis API when offline.

---

## 6. Background Synchronization (`sync_queue`)

### 6.1 Stats Queuing Mechanisms
- Stats queued when page turns accumulate (`localPagesReadRef.current >= 5`) or on Reader unmount (`sendReadingStats`).
- If network is unavailable (`!navigator.onLine`) or Supabase RPC fails (`update_reading_stats`), `enqueueReadingStats` writes item into `sync_queue` store.

### 6.2 Synchronization Trigger (`src/App.jsx`)
- `ProtectedRoute` attaches `window.addEventListener('online', handleOnline)`.
- On `online` event:
  - Fetches all items via `getSyncQueue()`.
  - Calls `supabase.rpc('update_reading_stats', { pages_read: item.pagesRead })` for each item.
  - Deletes items upon successful RPC call via `clearSyncQueueItem(item.id)`.

---

## 7. Build System, Dependencies & Testing Infrastructure

### 7.1 Package Scripts & Dependencies (`package.json`)
- **Scripts**: `"dev": "vite"`, `"build": "vite build"`, `"lint": "eslint ."`, `"preview": "vite preview"`.
- **Core Dependencies**:
  - `react`: `^19.2.6`
  - `react-dom`: `^19.2.6`
  - `react-pdf`: `^10.4.1`
  - `@supabase/supabase-js`: `^2.105.4`
  - `localforage`: `^1.10.0`
  - `react-router-dom`: `^7.15.0`
  - `vite-plugin-pwa`: `^1.3.0`

### 7.2 Test Infrastructure Gap
- **Current State**: Zero unit, integration, or end-to-end testing frameworks are configured in `package.json`. No test files exist in the repository.
