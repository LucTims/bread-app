# BRIEFING — 2026-08-08T02:42:00Z

## Mission
Analyze src/App.jsx and UI integration for Milestone 5 (R5: Intelligent Background Sync), investigating connectivity listeners, reconnection auto-flush, non-blocking execution, and app init sync.

## 🔒 My Identity
- Archetype: explorer
- Roles: Read-only codebase explorer & analyst
- Working directory: c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m5_2_gen3
- Original parent: 8a35f292-f6a5-4697-87d5-87a41d5c52d7
- Milestone: Milestone 5 (R5: Intelligent Background Sync)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement changes in source code directory
- All output files must be written within working directory `.agents/explorer_m5_2_gen3`

## Current Parent
- Conversation ID: 8a35f292-f6a5-4697-87d5-87a41d5c52d7
- Updated: 2026-08-08T02:42:00Z

## Investigation State
- **Explored paths**:
  - `src/App.jsx` (Lines 27-69, 104-162, 269-289)
  - `src/lib/connectivity.js` (Lines 1-225)
  - `src/lib/useOnlineStatus.js` (Lines 1-32)
  - `src/lib/offlineStore.js` (Lines 328-354)
  - `tests/e2e/tier1_features/r5_background_sync.test.js`
  - `tests/e2e/tier2_boundaries/r5_boundary_cases.test.js`
  - `tests/e2e/tier3_combinations/reconnection_auto_sync.test.js`
  - `tests/e2e/tier3_combinations/sync_backoff_network_flipflop.test.js`
- **Key findings**:
  1. `App.jsx` currently embeds sync logic inside `ProtectedRoute`, which is scoped to protected sub-routes only and missed on `/` or `/login`.
  2. App initialization sync is BROKEN: `prevOnlineRef.current` initializes to `isOnline` (`true`), causing `isOnline && !prevOnlineRef.current` to evaluate to `false` on initial app launch.
  3. Inline loop in `ProtectedRoute` uses raw RPC calls instead of delegating to an exported `flushSyncQueue(supabase)` helper.
  4. Lacks `connectivity-changed` window event listener and post-reauthentication sync trigger.
- **Unexplored areas**: None (all R5 investigation items fully completed).

## Key Decisions Made
- Formulated `useBackgroundSync` custom hook / top-level manager architecture for `App.jsx`.
- Detailed precise code modifications for `App.jsx` and `offlineStore.js` integration.

## Artifact Index
- ORIGINAL_REQUEST.md — Original request instructions
- BRIEFING.md — Working state index
- progress.md — Liveness heartbeat
- handoff.md — Comprehensive analysis and handoff report
