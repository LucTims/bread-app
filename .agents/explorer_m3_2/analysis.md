# Analysis Report: Milestone 3 — Offline-First Data Loading & Auth (R3)

**Agent**: Explorer 2 (`.agents/explorer_m3_2`)  
**Date**: 2026-08-07  
**Scope**: Inspection of `AuthContext.jsx`, `Home.jsx`, `Library.jsx`, `offlineStore.js`, `connectivity.js`, and R3 E2E test suites (`r3_data_loading.test.js`, `r3_boundary_cases.test.js`, `phantom_auth_cached_catalog.test.js`).

---

## Executive Summary
Milestone 3 (R3) establishes an offline-first data loading and authentication model. Key architectural achievements include:
1. **Dual-Tier Storage Architecture**: High-speed synchronous fast index stored in `localStorage` (`bread_book_index`, `bread_progress_index`) for immediate UI rendering (<5ms), paired with heavy binary/metadata storage in IndexedDB (`localforage`) for full background hydration.
2. **Offline & Phantom Auth Resilience**: `AuthContext.jsx` checks connectivity via `checkRealConnectivity()`. When offline or phantom connectivity is detected, Supabase network requests are bypassed entirely, falling back to cached user session credentials (`bread_cached_user`, `bread_cached_profile`).
3. **Spinner-Free Instant UI Rendering**: Both `Home.jsx` and `Library.jsx` initialize state directly from `getOfflineBooksSync()` and `getProgressMapSync()`. When offline, loading flags (`loading`) start as `false`, preventing blank screens, fallback flashes, or blocking network spinners.
4. **Comprehensive Test Coverage**: Complete E2E test suites cover synchronous catalog reads, IndexedDB hydration, cached auth persistence, cover blob URLs, disk storage calculations, JSON corruption fallbacks, expired session cleanups, quota exceeded error handling, large catalog scaling (120+ books <10ms), missing cover fallbacks, and phantom network state integration.

---

## 1. Deep Dive: `src/lib/AuthContext.jsx` Cached Session Fallback

### 1.1 Cache Storage Keys & Schema
- **`bread_cached_user`**: `localStorage` key holding serialized user object:
  ```json
  { "id": "usr_123", "email": "user@example.com" }
  ```
  *(Tokens are explicitly excluded to maintain security standard R3).*
- **`bread_cached_profile`**: `localStorage` key holding profile attributes:
  ```json
  { "id": "usr_123", "email": "user@example.com", "role": "reader", "created_at": "..." }
  ```

### 1.2 Auth Lifecycle & Connectivity Flow
```
                     ┌───────────────────────────────┐
                     │     AuthContext init()        │
                     └───────────────┬───────────────┘
                                     │
                       await checkRealConnectivity()
                                     │
                   ┌─────────────────┴─────────────────┐
                   ▼                                   ▼
             [ isOnline ]                       [ !isOnline ]
                   │                     (Offline or Phantom Network)
                   │                                   │
                   │                          getCachedUser() / getCachedProfile()
                   │                                   │
                   │                           ┌───────┴───────┐
                   │                           ▼               ▼
                   │                      [Found]         [Not Found]
                   │                           │               │
                   │                     setUser(cached)   setUser(null)
                   │                     setProfile(cached) setProfile(null)
                   │                     setLoading(false) setLoading(false)
                   │                     return; (NO network!) return;
                   │
         pre-fill UI from cache
                   │
       await supabase.auth.getSession()
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    [Session OK]      [Null / Error]
         │                   │
   setUser(user)       if network error:
   fetchProfile()        keep cached user
   cacheUserSession()  else:
                         setUser(null), clearCachedSession()
```

### 1.3 Offline & Phantom Network Guarantee
- When `checkRealConnectivity()` evaluates to `false` (offline or phantom network), `init()` immediately retrieves `getCachedUser()` and `getCachedProfile()`.
- If cached data exists: state is populated, `loading` is set to `false`, and execution returns **without issuing any Supabase HTTP requests**.
- If online: cached session pre-fills state immediately to prevent UI lag while Supabase verifies session token in the background.

---

## 2. Instant UI Rendering: `Home.jsx` & `Library.jsx`

### 2.1 Dual-Tier Storage Architecture (`src/lib/offlineStore.js`)
| Tier | Storage Target | Keys | Operation Speed | Data Content |
|---|---|---|---|---|
| **Tier 1 (Fast Index)** | `localStorage` | `bread_book_index`<br>`bread_progress_index` | Synchronous `<5ms` | Book metadata summary (`id`, `title`, `author`, `cover_url`, `sizeBytes`), reading progress (`currentPage`, `totalPages`, `lastReadAt`) |
| **Tier 2 (Heavy Store)** | IndexedDB (`localforage`) | `offline_books`<br>`book_meta`<br>`offline_covers`<br>`sync_queue` | Asynchronous | PDF Binary Blobs, full metadata objects, cover Image Blobs, offline sync queue |

### 2.2 `src/pages/Home.jsx` Inspection Findings
- **Synchronous First Render**:
  - `syncBooks = isOffline ? getOfflineBooksSync() : [];`
  - `syncProgress = isOffline ? getProgressMapSync() : {};`
  - `lastRead = useState(isOffline ? computeLastRead(syncBooks, syncProgress) : null);`
  - `loading = useState(!isOffline);` -> **`loading` is `false` immediately when offline.**
- **Bypassing Network Spinners**:
  - `useEffect` checks `if (isOffline)`, triggers background cover preloading (`preloadCoverUrls`), and immediately returns without calling Supabase.
  - The UI renders the offline banner, quote of the day, continue reading card, and offline book carousel instantly. Zero spinner or blank screen.

### 2.3 `src/pages/Library.jsx` Inspection Findings
- **Synchronous First Render**:
  - `syncBooks = isOfflineNow ? getOfflineBooksSync() : [];`
  - `syncProgress = isOfflineNow ? getProgressMapSync() : {};`
  - `syncStorage = isOfflineNow ? getStorageUsageSync() : { totalBytes: 0, bookCount: 0 };`
  - `books = useState(isOfflineNow ? syncBooks : []);`
  - `loading = useState(!isOfflineNow);` -> **`loading` is `false` immediately when offline.**
- **Offline Safeguard**:
  - `useEffect` checks `if (isOfflineNow)` and returns early after launching asynchronous cover URL resolution.
  - Bypasses `authLoading` and `navigate('/login')` checks when offline, rendering cached books, tab counts, and storage meter (`formatSize(storage.totalBytes)`) without UI delay.

---

## 3. Inspection of R3 Test Suite

### 3.1 Tier 1 Feature Tests (`tests/e2e/tier1_features/r3_data_loading.test.js`)
1. **R3-1**: Synchronous `localStorage` index returns catalog in `<5ms`. Verified duration benchmarking.
2. **R3-2**: Background hydration from IndexedDB (`getAllOfflineBooks`) resolves full metadata correctly.
3. **R3-3**: Offline auth persistence via `bread_cached_user` and `bread_cached_profile`.
4. **R3-4**: Offline cover loading from Blob cache via Object URLs (`getCoverObjectUrl`).
5. **R3-5**: Storage usage calculation (`getStorageUsage`) sums downloaded book bytes accurately.

### 3.2 Tier 2 Boundary Tests (`tests/e2e/tier2_boundaries/r3_boundary_cases.test.js`)
1. **R3-B1**: Graceful handling of corrupted JSON in `bread_book_index` (returns `[]` without throwing `SyntaxError`).
2. **R3-B2**: Expired offline auth session cleanup logic (`exp` timestamp check).
3. **R3-B3**: `QuotaExceededError` handling on `localStorage.setItem` without crashing PDF save pipeline.
4. **R3-B4**: Scalability test verifying 120+ book catalog reads synchronously in `<10ms`.
5. **R3-B5**: Missing cover Blob fallback returns `null` safely.

### 3.3 Tier 3 Combination Tests (`tests/e2e/tier3_combinations/phantom_auth_cached_catalog.test.js`)
1. **Combo 2**: Combined test for phantom network state + cached auth fallback + instant cached catalog rendering.

---

## 4. Verification Checklist & Invalidation Conditions
- **Verification Commands**: `node tests/e2e/runner.js`
- **Key Files**:
  - `src/lib/AuthContext.jsx` (Lines 77-93, 125-132)
  - `src/lib/offlineStore.js` (Lines 28-87, 267-295)
  - `src/pages/Home.jsx` (Lines 15-47, 59-71, 152-165)
  - `src/pages/Library.jsx` (Lines 30-46, 69-80)
  - `tests/e2e/tier1_features/r3_data_loading.test.js`
  - `tests/e2e/tier2_boundaries/r3_boundary_cases.test.js`
  - `tests/e2e/tier3_combinations/phantom_auth_cached_catalog.test.js`
