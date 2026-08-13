# Handoff Report: R5 Intelligent Background Sync — App.jsx & UI Integration Analysis

**Agent**: `explorer_m5_2_gen3`  
**Milestone**: Milestone 5 (R5: Intelligent Background Sync)  
**Target File**: `src/App.jsx` (and associated UI hooks / `src/lib/offlineStore.js`)  
**Date**: 2026-08-08  

---

## 1. Observation

### 1.1 Existing Implementation in `src/App.jsx`
Currently in `src/App.jsx`, sync queue processing is embedded inside the `ProtectedRoute` component (lines 27–48):

```javascript
// src/App.jsx lines 27-48
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { isOffline, isOnline } = useOnlineStatus();
  const prevOnlineRef = useRef(isOnline);

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

  if (isOffline || !isOnline) {
    return children;
  }
  ...
```

### 1.2 Connectivity Infrastructure (`src/lib/connectivity.js` & `src/lib/useOnlineStatus.js`)
- `src/lib/connectivity.js` line 39 dispatches a global window event:
  `window.dispatchEvent(new CustomEvent('connectivity-changed', { detail: { ..._lastKnownStatus } }));`
- `src/lib/connectivity.js` line 150 exports `subscribeToConnectivity(callback)` and `subscribeConnectivity(callback)`.
- `src/lib/useOnlineStatus.js` wraps `subscribeToConnectivity` and `checkRealConnectivity`, returning `{ isOnline, isOffline, isPhantom, lastChecked, checkNow }`.

### 1.3 Offline Store Sync Methods (`src/lib/offlineStore.js`)
- `offlineStore.js` currently exports:
  - `enqueueReadingStats(bookId, pagesRead, currentPage, totalPages)` (line 330)
  - `getSyncQueue()` (line 341)
  - `clearSyncQueueItem(id)` (line 352)
- `offlineStore.js` **lacks** an exported `flushSyncQueue(supabaseClient)` helper as mandated by `PROJECT.md` line 38.

### 1.4 Test Suite Expectations (`tests/e2e/...`)
- `tests/e2e/tier1_features/r5_background_sync.test.js`:
  - `R5-2`: Sync queue flushes queued items sequentially on reconnect.
  - `R5-4`: Non-blocking sync processing flushes 5 items in <200ms.
- `tests/e2e/tier2_boundaries/r5_boundary_cases.test.js`:
  - `R5-B1`: Max retries (3) leaves failed item in queue for backoff.
  - `R5-B3`: Network loss mid-sync pauses queue processing and preserves unsynced items (`if (!navigator.onLine) break;`).
  - `R5-B4`: Corrupt queue records (`item === null` or missing fields) are bypassed and cleared without throwing a `TypeError`.
  - `R5-B5`: 401 Unauthorized errors retain queue item until re-authentication.
- `tests/e2e/tier3_combinations/reconnection_auto_sync.test.js`:
  - `Combo 3`: Automatic background sync upon reconnection.
- `tests/e2e/tier3_combinations/sync_backoff_network_flipflop.test.js`:
  - `Combo 5`: Network flip-flop resilience (retaining queue during offline flip-flop, clearing on recovery).

---

## 2. Logic Chain

### Step 2.1: Defect in Reactive Connectivity Listener & Scoping
- **Observation**: The sync listener is currently inside `ProtectedRoute`.
- **Reasoning**: `ProtectedRoute` is only rendered when the user navigates to a protected route (`/home`, `/library`, `/reader/:id`, etc.). If the app is on an unprotected route (such as `/` Landing page or `/login`), `ProtectedRoute` is **unmounted**.
- **Consequence**: Connectivity state changes (e.g., regaining signal while on `/login` or `/`) will be **completely missed**, and offline reading stats will remain unsynced.
- **Resolution**: Background sync management MUST be elevated to top-level `AppContent` (or a dedicated `useBackgroundSync` hook mounted inside `AppContent`).

### Step 2.2: Defect in App Initialization Sync
- **Observation**: In `ProtectedRoute`, `prevOnlineRef` is initialized as `useRef(isOnline)`.
- **Reasoning**: If the app is launched while **Online** (`isOnline === true`):
  1. `prevOnlineRef.current` is set to `true`.
  2. In `useEffect`, the condition `if (isOnline && !prevOnlineRef.current)` evaluates to `true && !true` => `false`.
- **Consequence**: Pending items left in `sync_queue` from previous offline sessions are **NOT synced on app launch** if the app starts online.
- **Resolution**: App launch must explicitly trigger a sync check on initial mount if `isOnline` is true (`useEffect([], ...)`).

### Step 2.3: Defect in Inline Sync Loop vs `flushSyncQueue` Delegation
- **Observation**: `App.jsx` performs an unisolated inline loop with `supabase.rpc('update_reading_stats', ...)` and `clearSyncQueueItem(item.id)`.
- **Reasoning**:
  1. No check for mid-sync network loss (`R5-B3`): If connection drops on item 3 of 5, raw RPC calls fail and throw unhandled errors instead of pausing gracefully.
  2. No corrupt item bypass (`R5-B4`): If `item` in `sync_queue` is corrupt (`null`), `item.pagesRead` throws a fatal `TypeError`.
  3. No retry backoff or 401 handling (`R5-B1`, `R5-B5`): Transient server errors stop execution without isolating failures; 401 errors fail without scheduling re-sync post-auth.
- **Resolution**: `App.jsx` must delegate all sync operations to `flushSyncQueue(supabase)` exported from `src/lib/offlineStore.js`.

### Step 2.4: Guarantee of Non-Blocking UI Execution
- **Observation**: Requirement 5 mandates that background sync runs asynchronously without blocking modal overlays, freezing the UI, or interfering with reading/navigation.
- **Reasoning**:
  1. `flushSyncQueue(supabase)` runs asynchronously inside `useEffect` (unawaited promise chain).
  2. Errors are caught internally via `.catch()` or `try/catch`, preventing unhandled promise rejections.
  3. No state is set that triggers full-screen spinners or modal alert dialogs during sync.
  4. Execution time for typical queues (5 items) completes in <200ms without thread blocking.

---

## 3. Caveats

1. **Dependency on `offlineStore.js` Export**: `src/App.jsx` can only invoke `flushSyncQueue(supabase)` once `flushSyncQueue` is implemented and exported by `src/lib/offlineStore.js`.
2. **Concurrency Mutex (`isSyncingRef`)**: Rapid flip-flopping of network status (`online` -> `offline` -> `online`) could trigger multiple `flushSyncQueue` calls simultaneously. A flag (`isSyncingRef.current`) MUST be used in `App.jsx` / `useBackgroundSync` and `_isSyncing` in `offlineStore.js` to ensure sync calls run serially.
3. **Local Book Filtering**: Reading stats for user-imported local books (`isLocal: true` or `bookId.startsWith('local_')`) must never be synced to Supabase RPC.
4. **Re-Authentication Trigger**: When a user logs in (or session refreshes), `user` state transitions from `null` to object. Triggering `flushSyncQueue(supabase)` on auth state change resolves pending items blocked by prior 401 Unauthorized errors (`R5-B5`).

---

## 4. Conclusion & Proposed Modifications

### 4.1 Recommended Hook Creation: `src/lib/useBackgroundSync.js`
Create a clean custom hook `useBackgroundSync` (or embed within `App.jsx`):

```javascript
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import useOnlineStatus from './useOnlineStatus';
import { flushSyncQueue } from './offlineStore';
import { supabase } from './supabase';

export function useBackgroundSync() {
  const { isOnline } = useOnlineStatus();
  const { user } = useAuth();
  const prevOnlineRef = useRef(isOnline);
  const prevUserRef = useRef(user);
  const isSyncingRef = useRef(false);

  const triggerSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      await flushSyncQueue(supabase);
    } catch (err) {
      console.error('[BackgroundSync] Error during queue flush:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // 1. App Initialization Sync: Flush on mount if online
  useEffect(() => {
    if (isOnline) {
      triggerSync();
    }
  }, []);

  // 2. Reconnection Event Sync: Offline/Phantom -> Online transition
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      console.log('[BackgroundSync] Reconnected online -> triggering auto-flush');
      triggerSync();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, triggerSync]);

  // 3. Post-Authentication Sync: Auth state transition (resolves 401 retention)
  useEffect(() => {
    if (user && !prevUserRef.current && isOnline) {
      console.log('[BackgroundSync] User authenticated -> triggering sync check');
      triggerSync();
    }
    prevUserRef.current = user;
  }, [user, isOnline, triggerSync]);

  // 4. Global Window Connectivity Event Listener
  useEffect(() => {
    const handleConnectivityChanged = (evt) => {
      if (evt?.detail?.isOnline) {
        triggerSync();
      }
    };
    window.addEventListener('connectivity-changed', handleConnectivityChanged);
    return () => {
      window.removeEventListener('connectivity-changed', handleConnectivityChanged);
    };
  }, [triggerSync]);

  return { triggerSync };
}
```

### 4.2 Code Modifications for `src/App.jsx`

#### Addition 1: Import `flushSyncQueue` & `useBackgroundSync`
```javascript
import { getSyncQueue, clearSyncQueueItem, flushSyncQueue } from './lib/offlineStore';
import { useBackgroundSync } from './lib/useBackgroundSync'; // or inline hook
```

#### Addition 2: Mount `useBackgroundSync()` inside `AppContent`
```javascript
function AppContent() {
  const { user } = useAuth();

  // Activate intelligent background sync manager at top level
  useBackgroundSync();

  useEffect(() => {
    ...
```

#### Modification 3: Clean up `ProtectedRoute`
Remove the inline `useEffect` sync block from `ProtectedRoute`:

```javascript
// BEFORE (Remove lines 32-48):
// useEffect(() => {
//   if (isOnline && !prevOnlineRef.current) { ... }
// }, [isOnline]);

// AFTER:
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { isOffline, isOnline } = useOnlineStatus();
  
  // When offline (or phantom offline), let pages through
  if (isOffline || !isOnline) {
    return children;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }
  
  if (!user) {
    const currentPath = window.location.pathname;
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }
  
  return children;
}
```

---

## 5. Verification Method

To verify these changes after implementation:

1. **E2E Test Suite Run**:
   Execute the test suite covering Tier 1 through Tier 4:
   ```bash
   node tests/e2e/runner.js
   ```
   Specific test suites to inspect:
   - `tests/e2e/tier1_features/r5_background_sync.test.js` (R5-1 through R5-5)
   - `tests/e2e/tier2_boundaries/r5_boundary_cases.test.js` (R5-B1 through R5-B5)
   - `tests/e2e/tier3_combinations/reconnection_auto_sync.test.js` (Combo 3)
   - `tests/e2e/tier3_combinations/sync_backoff_network_flipflop.test.js` (Combo 5)

2. **Manual Inspection Points**:
   - Inspect `src/App.jsx` to ensure `useBackgroundSync()` is mounted inside `AppContent`.
   - Inspect `ProtectedRoute` to confirm no inline sync logic remains.
   - Confirm background sync triggers on:
     a) Initial app load when online.
     b) Reconnection (`isOnline: true` transition).
     c) Re-authentication post-login.
     d) `connectivity-changed` custom event dispatch.
