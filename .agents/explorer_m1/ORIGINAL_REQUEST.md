## 2026-08-07T16:16:05Z

You are Explorer M1 (archetype: teamwork_preview_explorer).
Working directory: c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m1
Target workspace: c:\Users\helpdesk\Desktop\bread-app

Your task:
Investigate and design the exact technical specification for Milestone 1: Real Connectivity Detection System (R2).

Requirements to satisfy:
- R2. Replace raw `navigator.onLine` checks across the app with a real connectivity detection system.
- Combine `navigator.onLine` with active HTTP reachability probing (e.g. lightweight fetch ping to a fast endpoint like `/favicon.svg` with cache-busting timestamp and short timeout e.g. 2500ms).
- Accurately distinguish: (a) truly online (`isOnline: true`), (b) truly offline (`isOffline: true`), (c) phantom connectivity (`isPhantom: true`, mobile data/WiFi connected but server unreachable).
- Both (b) and (c) must evaluate `isOffline: true` for local fallback logic.
- Publishes reactive events/callbacks within 5s of network change.
- Exposes clean module API `src/lib/connectivity.js` and React hook `src/lib/useOnlineStatus.js`.
- Details all 13 locations where `navigator.onLine` is currently used and how they will be refactored to use `useOnlineStatus` or `checkRealConnectivity`.

Write detailed strategy and design specification to `c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m1\analysis.md`.
Write handoff report to `c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m1\handoff.md`.
Send message to orchestrator with summary and path.
