## 2026-08-07T22:26:49+01:00
You are Worker 1 for Milestone 1: Real Connectivity Detection System (R2).
Your working directory is c:\Users\helpdesk\Desktop\bread-app\.agents\worker_m1.
Initialize your BRIEFING.md and progress.md inside c:\Users\helpdesk\Desktop\bread-app\.agents\worker_m1.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Objective & Scope:
Implement and verify Requirement R2 (Real Connectivity Detection System).

Context & Guidelines:
Read the investigation reports from Explorer 1 and Explorer 2:
- c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m1_1\analysis.md
- c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m1_1\handoff.md
- c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m1_2\analysis.md
- c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m1_2\handoff.md

Required Code Modifications:
1. `src/lib/connectivity.js`:
   - Fix `checkRealConnectivity` return type: must return `Promise<boolean>` (`true` if online and reachability ping succeeds, `false` otherwise).
   - Fix Phantom Connectivity state classification:
     - Truly Online: `{ isOnline: true, isOffline: false, isPhantom: false }`
     - Truly Offline: `{ isOnline: false, isOffline: true, isPhantom: false }`
     - Phantom Connectivity: `{ isOnline: false, isOffline: false, isPhantom: true }`
   - Cap probe timeout at <= 3000ms (default 2500ms) with `AbortController` to guarantee max network block <= 3s.
   - Maintain subscriber callbacks and window event `'connectivity-changed'` dispatching.
   - Ensure auto-probing interval (5000ms when visible) updates status within <= 5s.
2. `src/lib/useOnlineStatus.js`:
   - Ensure React hook cleanly returns `{ isOnline, isOffline, isPhantom, lastChecked, checkNow }`.
3. `src/lib/AuthContext.jsx` and UI components (`src/App.jsx`, `src/pages/Chat.jsx`):
   - Pre-check `checkRealConnectivity()` to resolve auth session fallback in < 3s without hanging on phantom connectivity.
4. `tests/e2e/harness.js` (if needed for test compatibility):
   - Use `Object.defineProperty(globalThis, 'navigator', ...)` if `globalThis.navigator = ...` throws in Node 21+.

Verification & Handoff:
1. Run `npm run build` or `npx vite build` to ensure no build errors.
2. Run `node tests/e2e/runner.js` to execute the E2E test suite.
3. Document exact build/test commands, outputs, and passing statuses in your handoff report `c:\Users\helpdesk\Desktop\bread-app\.agents\worker_m1\handoff.md`.
4. Send a completion message to the orchestrator with your results and file path.
