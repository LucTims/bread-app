## 2026-08-07T17:18:37Z
You are an E2E Test Developer (archetype: teamwork_preview_worker).
Working directory: c:\Users\helpdesk\Desktop\bread-app\.agents\worker_e2e_1
Target workspace: c:\Users\helpdesk\Desktop\bread-app

Your task is to build a comprehensive, requirement-driven opaque-box test suite for BoomRead PWA offline reliability based strictly on user requirements in `ORIGINAL_REQUEST.md`.

## Context & Requirements
Read `ORIGINAL_REQUEST.md` at root (`c:\Users\helpdesk\Desktop\bread-app\ORIGINAL_REQUEST.md`).
The requirements R1-R5 cover:
- R1: Guaranteed App Opening — Offline-First Shell (pre-cached shell, instant loading without network, phantom network resilience)
- R2: Real Connectivity Detection (probing distinguish online, offline, phantom connectivity)
- R3: Offline-First Data Loading (local storage/IndexedDB cache first, background net update)
- R4: Robust Offline Reading Experience (PDF offline rendering, progress save, SpeechSynthesis TTS)
- R5: Intelligent Background Sync (sync_queue auto-sync on reconnect, retry, non-blocking UI)

## Deliverables
1. **Test Infrastructure**:
   - `tests/e2e/harness.js`: Lightweight test harness simulating browser globals (`window`, `navigator.onLine`, `fetch` reachability prober mock, `localStorage`, `IndexedDB` localforage stores: `offline_books`, `book_meta`, `offline_covers`, `sync_queue`, `ServiceWorker` cache logic, and `SpeechSynthesis` TTS).
   - `tests/e2e/runner.js`: Test suite runner that executes all tests in `tests/e2e/`, groups them by tier, outputs pass/fail status per test, and prints summary counts.
   - Add `"test": "node tests/e2e/runner.js"` script to `package.json`.

2. **Test Cases (4 Tiers)**:
   - **Tier 1: Feature Coverage (`tests/e2e/tier1_features/*.test.js`)**: >=25 tests (at least 5 per feature R1-R5).
     - R1 Feature Coverage (5 tests)
     - R2 Feature Coverage (5 tests)
     - R3 Feature Coverage (5 tests)
     - R4 Feature Coverage (5 tests)
     - R5 Feature Coverage (5 tests)
   - **Tier 2: Boundary & Corner Cases (`tests/e2e/tier2_boundaries/*.test.js`)**: >=25 tests (at least 5 per feature R1-R5).
     - Empty cache / first launch, phantom network timeouts, network toggle during reading, sync retry limit, corrupt blobs, zero reading stats, max retry backoff, offline auth session expiration, fast toggle online/offline.
   - **Tier 3: Cross-Feature Combinations (`tests/e2e/tier3_combinations/*.test.js`)**: >=5 tests.
     - Offline + PDF reading + progress save + background queueing
     - Phantom network + Auth load + cached book list
     - Network restoration mid-reading + automatic background sync
     - Service worker cache hit + IndexedDB metadata retrieval + TTS fallback
     - Sync retry backoff + network state flip-flop
   - **Tier 4: Real-World Application Scenarios (`tests/e2e/tier4_realworld/*.test.js`)**: >=5 tests.
     - Full offline reading session (open app offline -> load library from IDB -> open book -> read pages -> track progress -> use browser TTS -> close app)
     - Subway commuting scenario (online download -> phantom network entry -> offline reading -> network restoration -> auto-flush sync_queue)
     - Airplane mode launch (open app with zero connectivity -> instant app shell -> cached profile & library)
     - Intermittent 3G phantom connection (slow network with 100% loss -> 3s timeout fallback to cached data -> UI unblocked)
     - Multi-book offline library sync (offline session across 3 books -> queued stats -> batch sync on reconnect)

3. **Verification**:
   - Run `node tests/e2e/runner.js` using `run_command`. Ensure all tests complete cleanly and produce a clear test report.

4. **Root Metadata Files**:
   - `c:\Users\helpdesk\Desktop\bread-app\TEST_INFRA.md` created using the standard template detailing test philosophy, feature inventory, test architecture, and coverage thresholds.
   - `c:\Users\helpdesk\Desktop\bread-app\TEST_READY.md` created summarizing test runner command (`node tests/e2e/runner.js` / `npm test`), coverage summary table (Tier 1-4 counts, total test count), and feature checklist.

5. **Handoff**:
   - Write `c:\Users\helpdesk\Desktop\bread-app\.agents\worker_e2e_1\handoff.md` summarizing what was created, test execution results, file paths, and send message back to parent.
