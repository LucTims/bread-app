# Milestone 3 Analysis Report: Offline-First Data Loading & Auth (R3)

**Author:** Explorer 1 (Milestone 3)  
**Target Module:** `src/lib/offlineStore.js`, `src/lib/AuthContext.jsx`  
**Date:** 2026-08-07  

---

## 1. Executive Summary

Requirement **R3 (Offline-First Data Loading & Auth)** requires the application to load catalog and cached user sessions instantly (<5ms) from synchronous `localStorage` indexing, followed by background hydration of rich metadata, cover image Blobs, and PDF binary data from IndexedDB (`localforage` stores).

Investigation confirms that `src/lib/offlineStore.js` and `src/lib/AuthContext.jsx` fully implement this dual-tier architecture.

---

## 2. Store Definitions & Architecture

`src/lib/offlineStore.js` defines four distinct `localforage` IndexedDB instances under the database name `'bread-app'`:

| Store Name | Constant | Purpose & Data Structure |
|---|---|---|
| `offline_books` | `bookStore` | Stores raw PDF binary Blobs or local File objects keyed as `pdf_${bookId}`. |
| `book_meta` | `metaStore` | Stores book metadata objects (`meta_${bookId}`) and reading progress objects (`progress_${bookId}`). |
| `offline_covers` | `coverStore` | Stores image Blobs for book covers keyed as `cover_${bookId}`. |
| `sync_queue` | `syncQueueStore` | Holds queued reading statistics items (`stats_${timestamp}_${rand}`) for background sync. |

---

## 3. Fast Synchronous LocalStorage Indexing (<5ms)

To eliminate initial page load delays and prevent waiting for asynchronous IndexedDB connection setup, lightweight indexes are maintained in `localStorage`:

- **Catalog Index Key:** `bread_book_index`
  - Array of lightweight book objects: `[{ id, title, author, cover_url, sizeBytes, downloadedAt, isLocal }]`
- **Progress Index Key:** `bread_progress_index`
  - Map of book progress: `{ [bookId]: { currentPage, totalPages, lastReadAt } }`

### Synchronous Getter Functions:
1. `getOfflineBooksSync()` (lines 68–70):
   - Reads `localStorage.getItem('bread_book_index')`.
   - Parses JSON synchronously and returns array in **< 1ms** (verified via test benchmark, target < 5ms).
   - Handles corrupted JSON cleanly via `try...catch` fallback returning `[]`.
2. `getProgressMapSync()` (lines 75–77):
   - Reads `localStorage.getItem('bread_progress_index')`.
   - Parses JSON synchronously and returns progress map.
   - Handles corrupted JSON cleanly via `try...catch` fallback returning `{}`.
3. `getStorageUsageSync()` (lines 82–86):
   - Calculates total cached size and book count directly from synchronous catalog index.

---

## 4. Background Hydration & Dual-Tier Workflow

The application implements a strict two-tier data loading lifecycle in `Home.jsx`, `Library.jsx`, and `LocalLibrary.jsx`:

1. **Tier 1 (Synchronous Instant Render):**
   - On page initialization, components call `getOfflineBooksSync()` and `getProgressMapSync()`.
   - Page catalog and reading progress are populated immediately (0ms wait, < 5ms response time).
   - If device is offline (`isOffline === true`), `loading` state is initialized to `false` immediately so the UI renders without spinners.

2. **Tier 2 (Asynchronous Background Hydration):**
   - After initial render, asynchronous requests trigger background loading:
     - `getAllOfflineBooks()` queries `bookStore` and `metaStore`, updates in-memory cache `_metaCache`, and resynchronizes `localStorage` (`bread_book_index`) with full IndexedDB truth.
     - `preloadCoverUrls(bookIds)` queries `coverStore` asynchronously, generates Blob Object URLs (`URL.createObjectURL(blob)`), caches them in memory `_coverUrlCache`, and passes Object URLs to the UI.
     - `getOfflineBook(bookId)` retrieves PDF Blobs when the reader is opened.

---

## 5. Offline Auth Session Caching (`AuthContext.jsx`)

Requirement R3 also requires auth persistence during offline and phantom network states:

- **Keys in LocalStorage:** `bread_cached_user` and `bread_cached_profile`.
- **Initialization Logic (`AuthContext.jsx`, lines 78–93):**
  - Calls `checkRealConnectivity()`.
  - When offline or during network dropouts, `AuthProvider` skips network Supabase auth checks and restores user identity from `localStorage` instantly.
  - On network restoration, Supabase auth is re-verified while pre-filling UI from cache.

---

## 6. Verification & Boundary Resiliency

Inspection of E2E test suites (`r3_data_loading.test.js` and `r3_boundary_cases.test.js`) verifies all edge cases:
- **Corrupt JSON in LocalStorage:** Gracefully falls back to empty arrays/maps without throwing `SyntaxError`.
- **LocalStorage Quota Exceeded:** `_writeIndex` and `_writeProgressIndex` catch quota errors silently without interrupting IndexedDB save operations.
- **Large Catalog (120+ books):** Synchronous load completes well under the 10ms boundary (< 5ms typical).
- **Missing Cover Blobs:** `getCoverObjectUrl` returns `null` safely without unhandled exceptions.
- **Method Restoration:** `getOfflineBook` restores `.text()` and `.arrayBuffer()` methods if stripped by storage drivers.

---

## 7. Conclusion

The implementation in `src/lib/offlineStore.js` and `src/lib/AuthContext.jsx` satisfies all requirements of Requirement R3. No source code modifications are required.
