## 2026-08-07T22:34:46Z
You are Worker worker_m3 (teamwork_preview_worker).
Your working directory is c:\Users\helpdesk\Desktop\bread-app\.agents\worker_m3. Create your working directory and place your state files (progress.md, handoff.md) there.

OBJECTIVE:
Execute, verify, build, and test Milestone 3 (Requirement R3: Offline-First Data Loading & Auth Persistence) for BoomRead PWA.

INPUT INFORMATION:
- Project Scope: c:\Users\helpdesk\Desktop\bread-app\PROJECT.md
- Explorer Reports:
  - c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m3_1\handoff.md
  - c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m3_2\handoff.md

TASKS:
1. Examine code in `src/lib/offlineStore.js`, `src/lib/AuthContext.jsx`, `src/pages/Home.jsx`, and `src/pages/Library.jsx`.
   - Verify fast synchronous localStorage catalog and progress indexing (`bread_book_index`, `bread_progress_index`) returning in < 5ms.
   - Verify IndexedDB localforage hydration (`offline_books`, `book_meta`, `offline_covers`, `sync_queue`).
   - Verify offline auth persistence in `AuthContext.jsx` using `bread_cached_user` and `bread_cached_profile` without waiting on network.
   - Verify instant UI rendering in `Home.jsx` and `Library.jsx` when offline without showing spinners.
2. Run build verification: `npx vite build` (or `npm run build`).
3. Run test verification: `node tests/e2e/runner.js`.
4. Fix any bugs, errors, or failures if discovered during build/test verification.
5. Write your handoff report to `c:\Users\helpdesk\Desktop\bread-app\.agents\worker_m3\handoff.md` with full build and test output logs.
6. Communicate your completion and handoff path back to parent via `send_message`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
