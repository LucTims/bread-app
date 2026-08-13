# Plan: BoomRead Offline Reliability Reinforcement

## Architecture & Objective
Reinforce offline reliability for BoomRead React/Vite PWA so that it opens and functions reliably regardless of network status or phantom connectivity (mobile data on with no internet reachability).

## Decomposition into Milestones

### Milestone 1: Real Connectivity Detection (R2)
- **Goal**: Implement `src/lib/connectivity.js` and `src/lib/useOnlineStatus.js` replacing raw `navigator.onLine`.
- **Requirements**:
  - Reachability probing (lightweight fetch with short timeout, e.g. 2-3s).
  - Accurately distinguish: Truly Online, Truly Offline, Phantom Connectivity.
  - UI updates within 5s of network state change.
  - Max network operation block <= 3s before fallback to local cache.

### Milestone 2: Guaranteed App Opening — Offline-First Shell (R1)
- **Goal**: Update `vite.config.js` Workbox / PWA config and app shell precaching.
- **Requirements**:
  - Pre-cached app shell loads header, nav, library view from SW cache.
  - Refreshing in offline mode loads within 2s without error screen.
  - Handles phantom connectivity (Slow 3G with 100% packet loss) by serving cached shell immediately.

### Milestone 3: Offline-First Data Loading & Auth Persistence (R3)
- **Goal**: Update `src/lib/offlineStore.js` and `src/lib/AuthContext.jsx`.
- **Requirements**:
  - Load book catalog from synchronous `localStorage` index (<5ms).
  - Hydrate metadata/covers from IndexedDB stores (`book_meta`, `offline_covers`).
  - Auth session persists offline using cached user/profile without showing login screen.

### Milestone 4: Robust Offline Reading Experience & Native TTS (R4)
- **Goal**: Update `src/pages/Reader.jsx` and TTS mechanisms.
- **Requirements**:
  - Downloaded PDF blob renders from IndexedDB (`offline_books`).
  - Page navigation and progress saved to IndexedDB & synchronous fast index (`bread_progress_index`).
  - Native browser `SpeechSynthesis` TTS fallback works offline without ElevenLabs API.

### Milestone 5: Intelligent Background Sync (R5)
- **Goal**: Update `src/lib/offlineStore.js` sync queue and `src/App.jsx` reconnect listener.
- **Requirements**:
  - Queue offline reading stats into `sync_queue` IndexedDB store.
  - Auto-flush `sync_queue` when real connectivity is restored.
  - Non-blocking execution with retry backoff and partial failure isolation.

### Milestone 6: E2E Testing Verification & Forensic Integrity Audit
- **Goal**: Run and verify all 60 tests in `tests/e2e/runner.js` across Tiers 1-4, plus Tier 5 adversarial testing and Forensic Auditor validation.

---

## Workflow & Execution Strategy per Milestone

For each milestone M1 through M5:
1. **Explorer**: Investigate current implementation, design detailed changes, identify edge cases.
2. **Worker**: Implement code changes, run build (`npm run build`) and test suite (`node tests/e2e/runner.js`).
3. **Reviewers**: 2 independent review passes checking code quality, robustness, interface contracts.
4. **Challengers**: 2 stress tests / empirical verification passes.
5. **Auditor**: Run forensic integrity checks to ensure no hardcoded mock bypasses or cheating.

Once M1-M5 are complete:
- Execute Milestone 6 for final comprehensive test suite run and final forensic audit.
