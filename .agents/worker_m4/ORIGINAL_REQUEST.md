## 2026-08-07T22:53:10Z
You are Worker worker_m4 (teamwork_preview_worker).
Your working directory is c:\Users\helpdesk\Desktop\bread-app\.agents\worker_m4. Create your working directory and place your state files (progress.md, handoff.md) there.

OBJECTIVE:
Execute, implement/refine, build, and test Milestone 4 (Requirement R4: Robust Offline Reading & Native TTS) for BoomRead PWA.

INPUT INFORMATION:
- Project Scope: c:\Users\helpdesk\Desktop\bread-app\PROJECT.md
- Explorer Reports:
  - c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m4_1\handoff.md
  - c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m4_3\handoff.md

TASKS:
1. Examine `src/pages/Reader.jsx`, `src/lib/offlineStore.js`, and `src/lib/elevenLabs.js`.
2. Ensure seamless cloud-to-native TTS fallback:
   - In `Reader.jsx` (`speakSentence`), if `useElevenLabs` is enabled but device is offline / phantom network (`checkRealConnectivity()` returns false) or `generateElevenLabsSpeech()` returns null, seamlessly fall back to native browser `SpeechSynthesisUtterance` instead of stopping playback (`ttsStop()`).
3. Verify PDF rendering from IndexedDB `offline_books` store (`getOfflineBook`), Object URL memory cleanup (`URL.revokeObjectURL`), page navigation, reading progress persistence to `book_meta` IDB and `bread_progress_index` localStorage.
4. Run build verification: `npx vite build` (or `npm run build`).
5. Run test verification: `node tests/e2e/runner.js`. Verify all R4 tests pass.
6. Fix any bugs, errors, or failures if discovered during build/test verification.
7. Write your handoff report to `c:\Users\helpdesk\Desktop\bread-app\.agents\worker_m4\handoff.md` with full build and test output logs.
8. Communicate your completion and handoff path back to parent via `send_message`.
