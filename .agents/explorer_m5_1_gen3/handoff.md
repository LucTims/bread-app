# Milestone 5 (R5: Intelligent Background Sync) Exploration & Analysis Handoff Report

## Executive Summary
This report analyzes `src/lib/offlineStore.js`, `src/App.jsx`, `src/pages/Reader.jsx`, and related modules with respect to Requirement 5 (Intelligent Background Sync) of the BoomRead offline reliability reinforcement project.

The investigation identified that while `enqueueReadingStats`, `getSyncQueue`, and `clearSyncQueueItem` exist in `src/lib/offlineStore.js`, the core function `flushSyncQueue(supabaseClient)` specified in `PROJECT.md` is **completely missing**. Currently, `src/App.jsx` relies on a crude inline `for...of` loop inside `ProtectedRoute` that lacks error isolation, attempt counters, exponential backoff, concurrency protection, corrupt record bypass, and mid-sync network loss detection.

---

## 1. Observation

### 1.1 Store Definition & `enqueueReadingStats` in `src/lib/offlineStore.js`
In `src/lib/offlineStore.js` (lines 22-26, 330-353):
```javascript
const syncQueueStore = localforage.createInstance({
  name: 'bread-app',
  storeName: 'sync_queue',
  description: 'File d\'attente pour la synchronisation des statistiques de lecture'
});

export async function enqueueReadingStats(bookId, pagesRead, currentPage, totalPages) {
  const id = `stats_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  await syncQueueStore.setItem(id, {
    bookId,
    pagesRead,
    currentPage,
    totalPages,
    timestamp: Date.now()
  });
}

export async function getSyncQueue() {
  const keys = await syncQueueStore.keys();
  const items = await Promise.all(keys.map(async k => {
    const data = await syncQueueStore.getItem(k);
    return { id: k, ...data };
  }));
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

export async function clearSyncQueueItem(id) {
  await syncQueueStore.removeItem(id);
}
```
**Key Observations**:
- `enqueueReadingStats` generates a unique string key `stats_${timestamp}_${rand7}`.
- Enqueued items store `{ bookId, pagesRead, currentPage, totalPages, timestamp }`.
- **Missing item metadata**: Items are created without `attempts` (number of failed sync tries) or `lastAttemptAt` (timestamp of last try).

### 1.2 Queue Enqueueing Trigger in `src/pages/Reader.jsx`
In `src/pages/Reader.jsx` (lines 86-103):
```javascript
const sendReadingStats = async () => {
    if (localPagesReadRef.current > 0) {
        const pagesToSync = localPagesReadRef.current;
        localPagesReadRef.current = 0;
        if (bookId.startsWith('local_')) return;
        const isOnline = await checkRealConnectivity();
        if (!isOnline) {
            await enqueueReadingStats(bookId, pagesToSync, pageNumber, numPages || 1).catch(() => {});
            return;
        }
        try {
            await supabase.rpc('update_reading_stats', { pages_read: pagesToSync });
        } catch (err) { 
            console.error('Error sending reading stats', err); 
            await enqueueReadingStats(bookId, pagesToSync, pageNumber, numPages || 1).catch(() => {});
        }
    }
};
```
**Key Observations**:
- Local imported books (`local_...`) bypass sync queueing.
- If offline (`!isOnline`), reading stats are queued to IndexedDB.
- If online, RPC `update_reading_stats` is attempted. On failure (e.g. server error/timeout), it catches the error and enqueues stats to IndexedDB.

### 1.3 Missing `flushSyncQueue` and Current Workaround in `src/App.jsx`
In `src/App.jsx` (lines 32-48):
```javascript
useEffect(() => {
  if (isOnline && !prevOnlineRef.current) {
    // Process offline reading stats queue
    (async () => {
      try {
        const queue = await getSyncQueue();
        for (const item of queue) {
          await supabase.rpc('update_reading_stats', { pages_read: item.pagesRead });
          await clearSyncQueueItem(item.id);
        }
      } catch (err) {
        console.error("Error syncing offline stats:", err);
      }
    })();
  }
  prevOnlineRef.current = isOnline;
}, [isOnline]);
```
**Key Observations & Deficiencies**:
1. **Missing Export**: `flushSyncQueue(supabaseClient)` does not exist in `src/lib/offlineStore.js`, violating the interface contract in `PROJECT.md` line 38.
2. **No Error Isolation**: The entire `for...of` loop is wrapped in a single `try...catch`. If `supabase.rpc` throws an error on item #1, the loop terminates immediately. Items #2, #3, etc. are never attempted.
3. **No Retry Tracking / Backoff**: Failed items stay in IndexedDB without recording `attempts` or `lastAttemptAt`. Every reconnect trigger immediately retries the same failing item without exponential delay.
4. **No Concurrency Lock**: Multiple network state changes or events can execute `App.jsx`'s `useEffect` simultaneously, leading to parallel sync loops and duplicate RPC calls.
5. **No Mid-Sync Loss Check**: If network drops midway through queue processing (e.g., after 2 of 4 items), `App.jsx` does not check `navigator.onLine` or `checkRealConnectivity()` inside the loop, resulting in avoidable failed RPC attempts.
6. **No Corrupt Record Bypass**: If an item in IndexedDB is null or lacks `pagesRead`, `item.pagesRead` throws a TypeError, breaking the entire queue.
7. **No 401 Unauthorized Handling**: 401 authentication errors abort processing without preserving the queue cleanly for post-login retry.

---

## 2. Logic Chain

1. **Requirement Mapping**: Requirement 5 (R5: Intelligent Background Sync) demands non-blocking, resilient background queue processing with retry backoff and partial failure isolation.
2. **Contract Analysis**: `PROJECT.md` mandates `flushSyncQueue(supabaseClient)` in `src/lib/offlineStore.js`.
3. **Failure Mode Analysis**:
   - **Scenario A (Partial Server Failure)**: If 5 stats items are queued and item #2 causes a server 500/503 error, items #3, #4, and #5 must still be processed (`R5-B4` / partial failure isolation). Current `App.jsx` implementation fails this because one error breaks out of the loop.
   - **Scenario B (Exponential Backoff)**: Retrying a failing item immediately on every connectivity event floods the server. Adding exponential backoff (`backoffMs = Math.min(1000 * 2^(attempts-1), 60000)`) ensures retries back off gracefully (1s, 2s, 4s, 8s, 16s, 32s, 60s) (`R5-B1`).
   - **Scenario C (Network Loss Mid-Sync)**: If connection drops after item #2 during a 5-item flush, the engine must stop the loop when `!navigator.onLine`, keeping items #3-#5 safely in IndexedDB without attempting failed HTTP requests (`R5-B3`).
   - **Scenario D (Concurrent Flushes)**: When `isOnline` transitions and a `'connectivity-changed'` event fires simultaneously, a module-level lock (`_isFlushing`) prevents duplicate execution (`R5-B2`).
   - **Scenario E (Corrupt Records)**: Corrupt or `null` IndexedDB records must be removed cleanly without throwing errors (`R5-B4`).
   - **Scenario F (401 Unauthorized)**: 401 response status indicates expired session. The item must be retained without deletion or excessive retries until re-authentication (`R5-B5`).

---

## 3. Caveats

1. **Read-Only Exploration**: No modifications were made to `src/lib/offlineStore.js` or `src/App.jsx` during this exploration.
2. **Local Books Excluded**: `Reader.jsx` explicitly filters out `bookId.startsWith('local_')`. Local books do not have server stats records in Supabase.
3. **Supabase Client**: `flushSyncQueue` must accept `supabaseClient` (or default to imported `supabase` client if omitted) to support unit test mocks and production execution.

---

## 4. Conclusion & Required Code Modifications

To satisfy Requirement 5, `src/lib/offlineStore.js` and `src/App.jsx` must be modified as follows:

### 4.1 Changes in `src/lib/offlineStore.js`

1. **Update `enqueueReadingStats`** to initialize retry tracking fields:
```javascript
export async function enqueueReadingStats(bookId, pagesRead, currentPage, totalPages) {
  const id = `stats_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  await syncQueueStore.setItem(id, {
    bookId,
    pagesRead,
    currentPage,
    totalPages,
    timestamp: Date.now(),
    attempts: 0,
    lastAttemptAt: null
  });
}
```

2. **Add and export `flushSyncQueue(supabaseClient)`**:
```javascript
// Retry policy constants
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;

let _isFlushing = false;

/**
 * Flushes queued reading stats to Supabase API with exponential backoff, retry handling, and error isolation.
 * 
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<{ flushedCount: number, failedCount: number, remainingCount: number }>}
 */
export async function flushSyncQueue(supabaseClient) {
  if (_isFlushing) {
    const remaining = await getSyncQueue();
    return { flushedCount: 0, failedCount: 0, remainingCount: remaining.length };
  }

  _isFlushing = true;
  let flushedCount = 0;
  let failedCount = 0;

  try {
    const queue = await getSyncQueue();
    if (!queue || queue.length === 0) {
      return { flushedCount: 0, failedCount: 0, remainingCount: 0 };
    }

    const now = Date.now();

    for (const item of queue) {
      // 1. Check network connectivity before processing each item (R5-B3)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        break; // Stop processing loop immediately when offline to preserve unsynced items
      }

      // 2. Corrupt / invalid item bypass (R5-B4)
      if (!item || !item.id || !item.bookId || typeof item.pagesRead !== 'number') {
        if (item && item.id) {
          await clearSyncQueueItem(item.id);
        }
        continue;
      }

      // 3. Check exponential backoff delay (R5-B1)
      const attempts = item.attempts || 0;
      if (attempts > 0 && item.lastAttemptAt) {
        const backoffDelay = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempts - 1), MAX_BACKOFF_MS);
        if (now - item.lastAttemptAt < backoffDelay) {
          // Backoff duration has not elapsed yet; skip item for this flush cycle
          continue;
        }
      }

      // 4. Per-item error isolation block
      try {
        if (supabaseClient && typeof supabaseClient.rpc === 'function') {
          const { error } = await supabaseClient.rpc('update_reading_stats', { pages_read: item.pagesRead });
          if (error) throw error;
        }

        // Successfully synced — remove from IndexedDB
        await clearSyncQueueItem(item.id);
        flushedCount++;
      } catch (err) {
        failedCount++;
        const isUnauth = err?.status === 401 || err?.statusCode === 401 || (err?.message && err.message.includes('401'));

        if (isUnauth) {
          // R5-B5: 401 Unauthorized retains item in queue without deletion or retries
          console.warn(`[offlineStore] Sync 401 Unauthorized for item ${item.id}, retaining queue until re-auth.`);
          continue;
        }

        // Record attempt count and timestamp for exponential backoff retry
        const updatedItem = {
          ...item,
          attempts: (item.attempts || 0) + 1,
          lastAttemptAt: Date.now(),
          lastError: err?.message || String(err)
        };

        await syncQueueStore.setItem(item.id, updatedItem);
      }
    }

    const remaining = await getSyncQueue();
    return { flushedCount, failedCount, remainingCount: remaining.length };
  } finally {
    _isFlushing = false;
  }
}
```

### 4.2 Changes in `src/App.jsx`

1. **Import `flushSyncQueue`** from `./lib/offlineStore`.
2. **Delegate reconnect sync** to `flushSyncQueue(supabase)` inside `ProtectedRoute` and subscribe to `connectivity-changed` events:
```javascript
// In ProtectedRoute or AppContent
useEffect(() => {
  if (isOnline && !prevOnlineRef.current) {
    flushSyncQueue(supabase).catch(err => console.error("[App] Reconnect sync error:", err));
  }
  prevOnlineRef.current = isOnline;
}, [isOnline]);

useEffect(() => {
  const handleConnectivityChange = (evt) => {
    if (evt?.detail?.isOnline) {
      flushSyncQueue(supabase).catch(err => console.error("[App] Event sync error:", err));
    }
  };
  window.addEventListener('connectivity-changed', handleConnectivityChange);
  return () => window.removeEventListener('connectivity-changed', handleConnectivityChange);
}, []);
```

---

## 5. Verification Method

1. **Unit & Integration Test Suite Verification**:
   Run all tests in the project test suite:
   ```bash
   node tests/e2e/runner.js
   ```
   Specifically verify:
   - `tests/e2e/tier1_features/r5_background_sync.test.js` (R5-1 through R5-5)
   - `tests/e2e/tier2_boundaries/r5_boundary_cases.test.js` (R5-B1 through R5-B5)
   - `tests/e2e/tier3_combinations/reconnection_auto_sync.test.js`
   - `tests/e2e/tier3_combinations/sync_backoff_network_flipflop.test.js`
   - `tests/e2e/tier4_realworld/multi_book_offline_sync.test.js`

2. **Manual Inspection**:
   - Verify `flushSyncQueue` is exported from `src/lib/offlineStore.js`.
   - Verify `App.jsx` calls `flushSyncQueue(supabase)`.
