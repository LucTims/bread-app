## 2026-08-08T01:40:14Z
You are Worker for Milestone 5: Intelligent Background Sync (R5).
Your working directory is c:\Users\helpdesk\Desktop\bread-app\.agents\worker_m5.
Initialize your BRIEFING.md and progress.md inside c:\Users\helpdesk\Desktop\bread-app\.agents\worker_m5.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Objective & Scope:
Implement and verify Requirement R5 (Intelligent Background Sync).

Context & Guidelines:
Read Explorer report at c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m5_1\handoff.md for complete code snippets and requirements.

Required Code Modifications:
1. `src/lib/offlineStore.js`:
   - Update `enqueueReadingStats`: return early if `!bookId || String(bookId).startsWith('local_')`. Set `attempts: 0`.
   - Implement & export `flushSyncQueue(supabaseClient)`:
     - Retrieve queue via `getSyncQueue()`.
     - Mid-sync network check: break loop if `navigator.onLine === false`.
     - Bypass & clear corrupt items (missing bookId/id).
     - Bypass & clear local book items (`local_*`).
     - Invoke `supabaseClient.rpc('update_reading_stats', { pages_read: item.pagesRead || 0 })`.
     - Partial failure isolation: wrap per-item RPC in `try...catch`, increment `item.attempts`, update item in IDB, retain items on 401 Unauthorized (break loop), clear item on success.
2. `src/App.jsx`:
   - Import `flushSyncQueue` from `./lib/offlineStore`.
   - In top-level `AppContent`, trigger `flushSyncQueue(supabase)` on `isOnline` transition (false -> true) and on `'connectivity-changed'` window events.
3. Build & Test Verification:
   - Run `npx vite build` to ensure bundle compiles.
   - Run `node tests/e2e/runner.js` to verify all 60 E2E tests pass (100% pass rate).
4. Document build/test outputs in `c:\Users\helpdesk\Desktop\bread-app\.agents\worker_m5\handoff.md` and send a completion message to the orchestrator.

## 2026-08-08T02:42:58Z
You are worker_m5, a versatile implementation worker assigned to execute Milestone 5 (R5: Intelligent Background Sync) of the BoomRead offline reliability reinforcement project.

Working directory: c:\Users\helpdesk\Desktop\bread-app\.agents\worker_m5
Project root: c:\Users\helpdesk\Desktop\bread-app

Your task:
Implement and verify Requirement 5 (Intelligent Background Sync) according to the specifications in `c:\Users\helpdesk\Desktop\bread-app\PROJECT.md` and the Explorer handoff reports at:
- `c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m5_1\handoff.md`
- `c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m5_2_gen3\handoff.md`

Specific modifications required:

1. `src/lib/offlineStore.js`:
   - Update `enqueueReadingStats(bookId, pagesRead, currentPage, totalPages)`: Guard against local books (`if (!bookId || String(bookId).startsWith('local_')) return;`). Set initial `attempts: 0`.
   - Implement and export `flushSyncQueue(supabaseClient)`:
     - Prevent concurrent flush runs with a mutex flag (`_isSyncing`).
     - Retrieve queue items from `syncQueueStore`.
     - Check network connectivity before processing each item (`if (typeof navigator !== 'undefined' && !navigator.onLine) break;`).
     - Bypass and clear corrupt items (`if (!item || typeof item !== 'object' || !item.bookId)`).
     - Bypass and clear local book items (`if (String(item.bookId).startsWith('local_'))`).
     - Process RPC `update_reading_stats` with `pages_read: item.pagesRead || 0`.
     - On 401 Unauthorized (`error.status === 401` or message includes '401'): retain item in queue and break loop so auth can refresh.
     - On transient errors: increment `item.attempts`, update item in `syncQueueStore`, and continue loop for remaining items (partial failure isolation).
     - On RPC success: remove item from queue via `clearSyncQueueItem(item.id)`.

2. `src/App.jsx` & `src/lib/useBackgroundSync.js`:
   - Create top-level `useBackgroundSync` hook or place top-level background sync listener in `AppContent`:
     - Initial mount check: if `isOnline`, trigger `flushSyncQueue(supabase)`.
     - Reconnection check: transition `isOnline && !prevOnlineRef.current` triggers `flushSyncQueue(supabase)`.
     - Post-auth check: transition `user && !prevUserRef.current` triggers `flushSyncQueue(supabase)`.
     - Event listener for window `'connectivity-changed'` custom event (`evt?.detail?.isOnline === true`) -> triggers `flushSyncQueue(supabase)`.
   - Remove legacy inline sync loop inside `ProtectedRoute`.

3. Build and Test Verification:
   - Run the E2E test runner using `run_command` in PowerShell:
     `node tests/e2e/runner.js`
   - Verify that all R5 tests pass (Tiers 1-4).
   - Record test output and results in your handoff report.

