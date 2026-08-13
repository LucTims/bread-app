# Orchestrator Soft Handoff — Generation 2 to Generation 3

**Date:** 2026-08-08  
**Predecessor:** Project Orchestrator (Gen 2)  
**Working Directory:** `c:\Users\helpdesk\Desktop\bread-app\.agents\orchestrator`  
**Parent Conversation ID:** `top-level`  

---

## 1. Milestone State

| # | Milestone | Status | Key Achievements & Verification |
|---|-----------|--------|--------------------------------|
| 1 | Connectivity Detection System (R2) | **DONE** | Implemented `src/lib/connectivity.js` and `src/lib/useOnlineStatus.js`. Fixed `checkRealConnectivity` return type (`Promise<boolean>`), 3-state classification (Online/Offline/Phantom), and `/favicon.ico` default ping URL. Reviewers passed, Forensic Auditor verdict **CLEAN**. |
| 2 | Offline-First Shell & PWA SW (R1) | **DONE** | Updated `vite.config.js` Workbox rules (`globPatterns` includes `jpg`/`jpeg`, `networkTimeoutSeconds` set to `3`), inline `#splash-screen` in `index.html`, SW `navigateFallback: '/index.html'`, `ProtectedRoute` offline auth bypass in `App.jsx`. Reviewers passed, Forensic Auditor verdict **CLEAN**. |
| 3 | Offline-First Data & Auth (R3) | **DONE** | Implemented & verified fast synchronous `localStorage` catalog & progress indexes (`bread_book_index`, `bread_progress_index` <5ms), IndexedDB hydration (`offline_books`, `book_meta`, `offline_covers`, `sync_queue`), offline auth session persistence in `AuthContext.jsx` (`bread_cached_user`, `bread_cached_profile`), and instant UI rendering without spinners in `Home.jsx` and `Library.jsx`. 13/13 tests passed, Reviewers passed, Forensic Auditor verdict **CLEAN**. |
| 4 | Offline Reading & Native TTS (R4) | **DONE** | Verified IndexedDB PDF Blob retrieval via `getOfflineBook()`, Object URL memory lifecycle management (`URL.revokeObjectURL` on change and unmount in `Reader.jsx`), page navigation clamping, reading progress persistence to `book_meta` IDB and `bread_progress_index` localStorage, and seamless cloud-to-native TTS fallback to browser `SpeechSynthesisUtterance` when offline or when ElevenLabs fails. All R4 E2E tests passed, Reviewers passed, Forensic Auditor verdict **CLEAN**. |
| 5 | Intelligent Background Sync (R5) | **IN_PROGRESS** | Non-blocking `sync_queue` background flush on network reconnection in `App.jsx` and `offlineStore.js`. Ready for Explorer phase. |
| 6 | E2E Testing & Final Verification | **PLANNED** | Final verification run of all 60 E2E tests in `node tests/e2e/runner.js` and Tier 5 adversarial testing. |

---

## 2. Active Subagents

All 20 subagents spawned in Generation 2 have completed their work and delivered handoff reports:
- Milestone 3: `worker_m3`, `reviewer_m3_1`, `reviewer_m3_2`, `challenger_m3_1`, `challenger_m3_2`, `auditor_m3` (ALL COMPLETED & CLEAN)
- Milestone 4: `explorer_m4_1`, `explorer_m4_2`, `explorer_m4_3`, `worker_m4`, `reviewer_m4_1_v2`, `reviewer_m4_2_v2`, `challenger_m4_1_v2`, `challenger_m4_2_v2`, `auditor_m4_v2` (ALL COMPLETED & CLEAN)

Currently **0 pending subagents**.

---

## 3. Key Decisions & Architecture Highlights

1. **`src/lib/connectivity.js`**: `checkRealConnectivity()` returns `Promise<boolean>`. Reachability timeout capped at `<= 3000ms`.
2. **`src/lib/offlineStore.js`**:
   - Dual-tier storage: synchronous `localStorage` indexes (`bread_book_index`, `bread_progress_index`) for instant UI startup (<5ms) + 4 `localforage` IndexedDB stores (`offline_books`, `book_meta`, `offline_covers`, `sync_queue`).
   - `enqueueReadingStats(stats)` queues offline reading statistics.
   - `flushSyncQueue(supabaseClient)` flushes queued items with partial failure isolation and retry handling.
3. **`src/lib/AuthContext.jsx`**: Offline/phantom status bypasses remote Supabase auth and resolves user session immediately from `bread_cached_user` and `bread_cached_profile`.
4. **`src/pages/Reader.jsx`**:
   - PDF Object URL management: `URL.revokeObjectURL(pdfUrlRef.current)` called prior to reassignment and on component unmount.
   - Native Browser TTS fallback: `speakSentence` checks `checkRealConnectivity()`. If offline or if ElevenLabs generation returns null/fails, seamlessly falls back to `SpeechSynthesisUtterance` without stopping playback (`ttsStop()`).

---

## 4. Remaining Work for Successor (Gen 3 Orchestrator)

1. **Execute Milestone 5 (R5: Intelligent Background Sync)**:
   - Start recurring heartbeat cron via `schedule(CronExpression="*/10 * * * *")`.
   - Dispatch Explorers (`explorer_m5_1`, `explorer_m5_2`) to analyze `sync_queue` background flush in `src/App.jsx` and `src/lib/offlineStore.js` (`enqueueReadingStats`, `flushSyncQueue`).
   - Dispatch Worker `worker_m5` (`teamwork_preview_worker`) to implement/verify non-blocking background sync on network reconnection (listening to `connectivity-changed` / `isOnline === true`), error isolation, and retry mechanics. Include mandatory integrity warning.
   - Dispatch Reviewers (`reviewer_m5_1`, `reviewer_m5_2`), Challengers (`challenger_m5_1`, `challenger_m5_2`), and Forensic Auditor (`auditor_m5`).
   - Mark Milestone 5 **DONE**.
2. **Execute Milestone 6 (E2E Testing & Final Verification)**:
   - Run complete E2E test suite (`node tests/e2e/runner.js`) across all 60 tests (Tiers 1–4).
   - Perform Tier 5 white-box adversarial coverage hardening.
   - Run final Forensic Audit (`teamwork_preview_auditor`).
   - Deliver final project report to parent (`top-level`).

---

## 5. Key Artifacts

- `c:\Users\helpdesk\Desktop\bread-app\PROJECT.md` — Project architecture & milestone registry
- `c:\Users\helpdesk\Desktop\bread-app\TEST_INFRA.md` — Test suite spec
- `c:\Users\helpdesk\Desktop\bread-app\TEST_READY.md` — Test summary table
- `c:\Users\helpdesk\Desktop\bread-app\.agents\orchestrator\BRIEFING.md` — Persistent working memory index
- `c:\Users\helpdesk\Desktop\bread-app\.agents\orchestrator\progress.md` — Liveness & checklist log
