# BoomRead PWA E2E Test Infrastructure Specification

## 1. Test Philosophy & Design Goals
The BoomRead PWA offline test suite is designed as an opaque-box, requirement-driven E2E test architecture. It validates the application's offline-first resilience under real-world connectivity states, background synchronization mechanics, and local storage caching without relying on external web network services.

### Core Principles
- **Genuine Execution**: Zero hardcoded test results, facade mocks, or shortcut assertions.
- **Offline-First Guarantee**: Verification that app shell, data loading, reading, and auth operate seamlessly without active network.
- **Real Connectivity Classification**: Probing mechanism distinguishing Truly Online, Truly Offline, and Phantom Connectivity (network data enabled with 0% reachability).
- **Non-Blocking Reliability**: Storage reads (localStorage <5ms index) and background sync (`sync_queue`) do not freeze user interface.

---

## 2. Feature Inventory & Mapping

| Feature ID | Feature Name | Description | Key Components Tested |
|------------|--------------|-------------|----------------------|
| **R1** | Guaranteed App Opening — Offline-First Shell | Pre-cached shell, instant loading without network, phantom resilience | `vite.config.js` Workbox rules, SW `caches.match`, `index.html` fallback |
| **R2** | Real Connectivity Detection | Combining `navigator.onLine` with active reachability probing | `src/lib/connectivity.js`, `src/lib/useOnlineStatus.js` |
| **R3** | Offline-First Data Loading | Synchronous index load (<5ms), IDB metadata hydration, cached auth | `src/lib/offlineStore.js`, `src/lib/AuthContext.jsx` |
| **R4** | Robust Offline Reading Experience | Offline PDF blob rendering, page progress saving, native browser TTS | `src/pages/Reader.jsx`, SpeechSynthesis API, `metaStore` |
| **R5** | Intelligent Background Sync | Automatic flush of `sync_queue` on reconnection with retry resilience | `sync_queue` store, `App.jsx` reconnect listener, retry backoff |

---

## 3. Test Architecture & Environment

### Test Harness (`tests/e2e/harness.js`)
Lightweight, Node-native simulation environment providing:
- **Global Environment**: Simulated `window`, `navigator`, `localStorage`, `caches`, `fetch`.
- **Connectivity Control**: `setNetworkState(NetworkState.ONLINE | OFFLINE | PHANTOM)` toggles `navigator.onLine` and fetch reachability behavior.
- **IndexedDB & LocalForage**: Stores for `offline_books`, `book_meta`, `offline_covers`, `sync_queue` with async storage operations.
- **SpeechSynthesis Simulator**: Native browser TTS voice listing and utterance event lifecycle handling.
- **Service Worker Cache**: `MockCacheStorage` supporting CacheFirst and NetworkFirst caching strategies.

### Test Runner (`tests/e2e/runner.js`)
- Dynamic test discovery across 4 tier directories.
- Automatic per-test environment reset (`resetTestEnvironment()`).
- Detailed performance timing and per-tier execution summary table output.
- Non-zero exit code on failure for CI/CD integration.

---

## 4. Test Tiers & Coverage Thresholds

```
tests/e2e/
├── harness.js
├── runner.js
├── tier1_features/       (25 tests - R1 to R5 coverage)
├── tier2_boundaries/     (25 tests - Boundary, edge, & corner cases)
├── tier3_combinations/   (5 tests  - Cross-feature multi-store workflows)
└── tier4_realworld/      (5 tests  - Real-world scenario simulations)
```

### Coverage Thresholds
- **Tier 1 (Feature Coverage)**: 25 tests (5 per feature R1-R5) — 100% required pass rate.
- **Tier 2 (Boundary & Corner Cases)**: 25 tests (5 per feature R1-R5) — 100% required pass rate.
- **Tier 3 (Cross-Feature Combinations)**: 5 tests — 100% required pass rate.
- **Tier 4 (Real-World Scenarios)**: 5 tests — 100% required pass rate.
- **Total Test Count**: 60 tests minimum.
