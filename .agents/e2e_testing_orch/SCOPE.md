# Scope: E2E Test Suite for BoomRead PWA Offline Reliability

## Architecture & Test Philosophy
- **Approach**: Opaque-box, requirement-driven E2E testing derived strictly from user requirements R1-R5 in `ORIGINAL_REQUEST.md`.
- **Framework**: Node.js test runner (`node --test` or custom runner script) with simulated browser APIs (indexedDB, localStorage, navigator.onLine, fetch probing, SpeechSynthesis) for deterministic, headless execution.
- **Verification**: Tests run via `npm test` or `node tests/e2e/runner.js`.

## Features Inventory
| # | Feature | Requirement | Description |
|---|---------|-------------|-------------|
| R1 | Offline-First Shell | R1 | Precached app shell, instant load from SW/cache without net |
| R2 | Real Connectivity Detection | R2 | Reachability probing distinguishing online, offline, and phantom connectivity |
| R3 | Offline-First Data Loading | R3 | Immediate local cache render + background net update |
| R4 | Robust Offline Reading | R4 | Offline PDF rendering, page nav, progress save, native TTS |
| R5 | Intelligent Background Sync | R5 | Auto-sync `sync_queue` on reconnection with retry & non-blocking UI |

## Test Tier Decomposition
| Tier | Description | Target Count | Path |
|------|-------------|--------------|------|
| Tier 1 | Feature Coverage (R1-R5 happy path) | >= 25 tests (5 per feature) | `tests/e2e/tier1_features/` |
| Tier 2 | Boundary & Corner Cases | >= 25 tests (5 per feature) | `tests/e2e/tier2_boundaries/` |
| Tier 3 | Cross-Feature Combinations | >= 5 tests (pairwise interactions) | `tests/e2e/tier3_combinations/` |
| Tier 4 | Real-World Application Scenarios | >= 5 tests (end-to-end user journeys) | `tests/e2e/tier4_realworld/` |

## Milestones & Status
| # | Task | Status | Output Files |
|---|------|--------|--------------|
| 1 | Test Harness & Environment Setup | IN_PROGRESS | `tests/e2e/harness.js`, `tests/e2e/runner.js` |
| 2 | Tier 1 & Tier 2 Test Suites | PLANNED | `tests/e2e/tier1_features/*.test.js`, `tests/e2e/tier2_boundaries/*.test.js` |
| 3 | Tier 3 & Tier 4 Test Suites | PLANNED | `tests/e2e/tier3_combinations/*.test.js`, `tests/e2e/tier4_realworld/*.test.js` |
| 4 | Verification & Summary Reports | PLANNED | `TEST_INFRA.md`, `TEST_READY.md` |
