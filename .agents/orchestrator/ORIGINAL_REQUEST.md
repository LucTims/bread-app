# Original User Request

## 2026-08-07T22:12:17Z

Renforcer la fiabilité hors-ligne de l'application BoomRead (une PWA React/Vite de lecture d'ebooks) pour qu'elle s'ouvre et fonctionne **toujours**, même sans aucune connexion réseau, ou quand les données mobiles sont activées sans connectivité réelle. L'objectif est une expérience "offline-first" où tout ce qui peut fonctionner localement fonctionne immédiatement, avec synchronisation intelligente en arrière-plan dès que le réseau revient.

Working directory: c:\Users\helpdesk\Desktop\bread-app
Integrity mode: development

## Context — Current Architecture

The app is a React/Vite PWA using:
- **vite-plugin-pwa** with Workbox (autoUpdate registration)
- **localforage** (IndexedDB wrapper) with 4 stores: `offline_books` (PDF blobs), `book_meta` (metadata + progress), `offline_covers` (cover blobs), `sync_queue` (deferred reading stats)
- **localStorage** fast indexes: `bread_book_index`, `bread_progress_index`, `bread_cached_user`, `bread_cached_profile`
- **Service Worker** with CacheFirst for fonts/covers, NetworkFirst for Supabase API/storage (5-10s timeouts)
- **react-pdf** for PDF rendering, **SpeechSynthesis API** for native TTS
- **navigator.onLine** for offline detection (THIS IS THE MAIN PROBLEM — it returns true when mobile data is on but has no actual connectivity)

Key files:
- `vite.config.js` — PWA/Workbox config
- `src/lib/offlineStore.js` — All IndexedDB/localStorage operations
- `src/pages/Reader.jsx` — PDF reader with offline fallback
- `src/App.jsx` — Route protection + online event sync listener
- `src/lib/AuthContext.jsx` — Auth with cached session fallback
- `src/main.jsx` — SW registration
- `index.html` — Splash screen + PWA meta tags

## Requirements

### R1. Guaranteed App Opening — Offline-First Shell

The app must always open and display usable content regardless of network state. The current behavior where the app shell can fail to load or hang when there is phantom connectivity (mobile data enabled with no real internet) must be eliminated. The app shell, all UI routes, and the library view must render from cache first, every time.

### R2. Real Connectivity Detection

Replace the unreliable `navigator.onLine` check with a true connectivity detection system that combines `navigator.onLine` with actual reachability probing (e.g., a lightweight fetch to a known endpoint with a short timeout). The app must accurately distinguish between: (a) truly online, (b) truly offline, and (c) phantom connectivity (data enabled but unreachable). Cases (b) and (c) must both be treated as offline with graceful local fallback.

### R3. Offline-First Data Loading

All data-fetching operations (book list, metadata, covers, reading progress, user profile) must follow an offline-first pattern: load from local cache immediately, then update from network in the background if connectivity is confirmed. The user must never see a loading spinner or blank screen waiting for a network response when cached data exists locally.

### R4. Robust Offline Reading Experience

All locally downloaded books must be fully readable offline, including: PDF rendering, page navigation, reading progress tracking, and native browser TTS (not ElevenLabs cloud TTS). The reader must never show an error or blank page for a book that has been previously downloaded to IndexedDB.

### R5. Intelligent Background Sync

When real connectivity is restored, the app must automatically sync all queued data (reading statistics, progress updates) from the `sync_queue` IndexedDB store to the server. The sync must be resilient to partial failures and not block the UI.

## Acceptance Criteria

### App Shell Reliability
- [ ] With the dev server stopped and browser in offline mode, navigating to the app URL loads the full app shell (header, navigation, library view) from the service worker cache
- [ ] With Chrome DevTools "Network" set to "Offline", refreshing the page loads the app within 2 seconds without any error screen
- [ ] The app loads successfully when Chrome DevTools network throttling is set to "Slow 3G" with 100% packet loss (simulating phantom connectivity)

### Connectivity Detection
- [ ] The app correctly identifies "no real internet" when network is technically available but unreachable (verifiable by blocking external requests in DevTools while keeping navigator.onLine = true)
- [ ] Connectivity state changes are reflected in the UI within 5 seconds of the actual network change
- [ ] No network-dependent operation blocks the UI for more than 3 seconds before falling back to cached data

### Offline Library & Navigation
- [ ] The library/home page displays all previously synced books with covers loaded from IndexedDB when offline
- [ ] Navigating between app routes (home, library, reader, settings) works without errors when offline
- [ ] User profile and session persist across app restarts when offline (no login screen shown)

### Offline Reading
- [ ] Opening a previously downloaded book works instantly when offline (no loading errors)
- [ ] Page navigation (next/previous) works smoothly offline
- [ ] Reading progress is saved to IndexedDB when offline and visible upon reopening the book
- [ ] Native TTS (browser SpeechSynthesis) works on downloaded books when offline

### Background Sync
- [ ] Reading stats accumulated offline are automatically synced when connectivity is restored (verify by checking `sync_queue` in IndexedDB empties after reconnection)
- [ ] Failed sync attempts are retried without data loss
- [ ] Sync operations do not freeze or block the UI

### Verification Method
- [ ] All criteria above can be verified using Chrome DevTools (Network tab → Offline toggle, Application tab → Service Workers, IndexedDB inspection) and the running dev server (`npm run dev`)

## Follow-up — 2026-08-07T23:33:46Z

You are the Generation 2 Project Orchestrator for the BoomRead offline reliability reinforcement task.
Resume work at c:\Users\helpdesk\Desktop\bread-app\.agents\orchestrator. Read handoff.md, BRIEFING.md, ORIGINAL_REQUEST.md, and progress.md for current state.
Your parent is top-level — use this ID for all escalation and status reporting (send_message).

Summary of Current Progress & Instructions for Gen 2 Orchestrator:
- Milestone 1 (R2: Real Connectivity Detection) is DONE & verified CLEAN.
- Milestone 2 (R1: Guaranteed App Opening — Offline-First Shell) is DONE & verified CLEAN.
- Milestone 3 (R3: Offline-First Data Loading & Auth) is IN_PROGRESS. Explorers M3-1 and M3-2 completed deep-dive analysis (`c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m3_1\handoff.md` and `c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m3_2\handoff.md`).
- Next Step: Start heartbeat cron via schedule(CronExpression="*/10 * * * *"), then dispatch worker_m3 (teamwork_preview_worker) for Milestone 3, followed by reviewers (reviewer_m3_1, reviewer_m3_2) and auditor (auditor_m3).
- Proceed through Milestones 3, 4, 5, and 6 to final completion.

## Follow-up — 2026-08-08T02:35:33Z

You are the Generation 3 Project Orchestrator for the BoomRead offline reliability reinforcement task.
Resume work at c:\Users\helpdesk\Desktop\bread-app\.agents\orchestrator. Read handoff.md, BRIEFING.md, ORIGINAL_REQUEST.md, and progress.md for current state.
Your parent is top-level — use this ID for all escalation and status reporting (send_message).

Summary of Progress & Instructions for Gen 3 Orchestrator:
- Milestone 1 (R2: Real Connectivity Detection) is DONE & verified CLEAN.
- Milestone 2 (R1: Guaranteed App Opening — Offline-First Shell) is DONE & verified CLEAN.
- Milestone 3 (R3: Offline-First Data Loading & Auth) is DONE & verified CLEAN.
- Milestone 4 (R4: Robust Offline Reading & Native TTS) is DONE & verified CLEAN.
- Milestone 5 (R5: Intelligent Background Sync) is ready to execute.
- Next Step: Start heartbeat cron via schedule(CronExpression="*/10 * * * *"), then dispatch Explorers for Milestone 5 (R5: sync_queue background flush, retry strategy, exponential backoff in App.jsx and offlineStore.js), followed by worker_m5, reviewers (reviewer_m5_1, reviewer_m5_2), and auditor (auditor_m5).
- Proceed through Milestones 5 and 6 to final project completion.


