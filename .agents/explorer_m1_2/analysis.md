# Analysis Report: React Integration for Real Connectivity Detection System (R2)

**Author**: Explorer 2  
**Milestone**: Milestone 1 — Real Connectivity Detection System (R2)  
**Date**: 2026-08-07  
**Scope**: `src/lib/useOnlineStatus.js`, `src/App.jsx`, `src/lib/AuthContext.jsx`, React UI components, and raw browser network event usages.

---

## 1. Examination of `src/lib/useOnlineStatus.js` & Component Consumption

### 1.1 Hook Architecture (`src/lib/useOnlineStatus.js`)
The `useOnlineStatus` custom React hook provides a reactive interface between React component lifecycle/state and the core connectivity singleton defined in `src/lib/connectivity.js`.

- **State Initialization**: 
  - Seeding state via `useState(() => getConnectivityStatus())` ensures zero-latency initial rendering with the cached/current connectivity classification.
- **Subscription Mechanism**:
  - `useEffect` invokes `subscribeToConnectivity((newStatus) => setStatus(newStatus))`.
  - `subscribeToConnectivity` in `connectivity.js` immediately triggers the callback upon subscription, eliminating race conditions between hook mount and first probe result.
- **Mount Freshness Probe**:
  - Calls `checkRealConnectivity()` asynchronously inside `useEffect` on mount to guarantee fresh verification of the network path.
- **Exposed Return Signature**:
  ```javascript
  return {
    isOnline: status.isOnline,     // true if fully connected (HTTP reachability confirmed)
    isOffline: status.isOffline,   // true if hardware offline OR phantom offline
    isPhantom: status.isPhantom,   // true if hardware online but HTTP reachability probe failed
    lastChecked: status.lastChecked, // timestamp (ms) of last probe/update
    checkNow: useCallback(...)     // async function to force active probe check
  };
  ```

### 1.2 React Component Consumption Matrix

| Component File | Import Path | State Consumed | Current Usage Rationale |
| :--- | :--- | :--- | :--- |
| `src/App.jsx` (`ProtectedRoute`) | `./lib/useOnlineStatus` | `isOffline`, `isOnline` | - **Bypass Auth Redirect**: If `isOffline` is true, immediately renders children to allow offline reading without redirecting to `/login`.<br/>- **Background Queue Sync**: On `isOnline` transition (`isOnline && !prevOnlineRef.current`), flushes offline reading stats queue from `IndexedDB` to Supabase `update_reading_stats` RPC. |
| `src/components/TopBar.jsx` | `../lib/useOnlineStatus` | `isOnline` | - **Conditional Profile Fetch**: Executes Supabase RPC query for `current_streak` only when `user` exists and `isOnline` is true. |
| `src/pages/Home.jsx` | `../lib/useOnlineStatus` | `isOffline` | - **Sync State Seeding**: Reads `getOfflineBooksSync()` and `getProgressMapSync()` when `isOffline` is true.<br/>- **Offline UI Mode**: Hides online promotional cards / PWA install prompts, shows Offline Notice Banner ("Hors ligne - Consultation des livres téléchargés"), and restricts rendering to locally downloaded books. |
| `src/pages/Library.jsx` | `../lib/useOnlineStatus` | `isOffline` | - **Dynamic Source Switching**: Instantly switches book catalog source between online Supabase query and local IndexedDB cache (`getOfflineBooksSync()`). |
| `src/pages/AIChat.jsx` | `../lib/useOnlineStatus` & `connectivity.js` | `isOnline`, `isOffline` | - **Online Book Fetching**: Inhibits background online catalog fetch when `!isOnline`.<br/>- **Active Probe on Action**: Directly calls `checkRealConnectivity()` before sending AI prompt; blocks execution with user alert if `isOffline`. |
| `src/pages/Reader.jsx` | `../lib/connectivity` | Direct `checkRealConnectivity()` calls | - Performs explicit `checkRealConnectivity()` calls when initializing reader, saving position, or loading audio. |

---

## 2. Examination of `src/App.jsx` and `src/lib/AuthContext.jsx` for 5s UI Updates & Non-Blocking 3s Fallback

### 2.1 Non-Blocking 3s Fallback Mechanism (Requirement R2)
- **Problem**: When a user experiences **Phantom Connectivity** (modem/Wi-Fi connected to router but no WAN internet access or behind a captive portal), standard Supabase `supabase.auth.getSession()` calls block execution for 10–30 seconds waiting for TCP connection timeouts.
- **Solution in `AuthContext.jsx`**:
  - In `init()` (lines 78–93 of `src/lib/AuthContext.jsx`), `checkRealConnectivity()` is executed **before** attempting Supabase network authentication:
    ```javascript
    const connStatus = await checkRealConnectivity();
    if (connStatus.isOffline) {
        const cachedUser = getCachedUser();
        const cachedProfile = getCachedProfile();
        if (cachedUser && mounted) {
            setUser(cachedUser);
            setProfile(cachedProfile);
            setLoading(false);
        }
        return; // Prevents hanging network calls!
    }
    ```
  - Probe Timeout Budget: In `src/lib/connectivity.js`, active probe timeout is configured to **2500ms** (`options.timeoutMs ?? 2500`).
  - **Result**: In phantom offline scenarios, `checkRealConnectivity()` times out in **2.5s** (under the 3s fallback limit), classifies the state as `{ isOnline: false, isOffline: true, isPhantom: true }`, and `AuthContext` immediately falls back to `getCachedUser()` and `getCachedProfile()`, resolving `loading = false` without hanging the UI.

### 2.2 UI Propagation & 5-Second Update Guarantee
- **Periodic Probing**: `src/lib/connectivity.js` runs periodic health checks every **5 seconds** (`setInterval(..., 5000)`) whenever `document.visibilityState === 'visible'`.
- **Hardware Event Reactivity**: Instant hardware events (`online`, `offline`) trigger immediate re-probing or offline status updates (0ms delay).
- **Subscriber Dispatch**: Any status update in `connectivity.js` calls `updateStatus()`, notifying subscribers (`subscribeToConnectivity`).
- **React Re-render**: `useOnlineStatus` hook updates React state, triggering re-renders across `App.jsx`, `TopBar.jsx`, `Home.jsx`, and `Library.jsx` within < 5s (or immediately on hardware toggle).

### 2.3 Key Architectural Findings & Edge Cases
1. **`AuthContext.jsx` Re-connection Gap**:
   - `AuthContext.jsx` runs `init()` only once on initial mount (`useEffect([], ...)`).
   - If the app launches offline, `AuthContext` uses `cachedUser`. If the device regains connectivity later, `AuthContext` does not currently subscribe to `subscribeToConnectivity()` or `useOnlineStatus()` to re-verify `supabase.auth.getSession()` or fetch updated profile data.
2. **`Chat.jsx` Realtime WebSocket Leak**:
   - `src/pages/Chat.jsx` attempts to subscribe to Supabase Realtime presence channels and query chat messages without checking connectivity state. In phantom offline mode, WebSocket connections linger and generate uncaught connection errors.

---

## 3. Comprehensive Inventory of `navigator.onLine` and Network Event Usages

### 3.1 Core System Usages (`src/lib/connectivity.js`) — Legitimate
- **Line 10-11**: Seeding initial hardware state (`navigator.onLine`).
- **Line 65**: Fast-path hardware offline check (`if (!navigator.onLine)`).
- **Line 101**: Disambiguated hardware vs probe failure check (`isHardwareOnline`).
- **Lines 186-187**: Window event listeners (`window.addEventListener('online')`, `window.addEventListener('offline')`).
- *Assessment*: Legitimate internal implementation details of the R2 Real Connectivity System.

### 3.2 Non-Network Browser Feature API Usages — Legitimate
- `src/lib/pwaInstallLogger.js` (Line 8): `navigator.userAgent`, `navigator.maxTouchPoints` (PWA telemetry).
- `src/lib/pushManager.js` (Lines 23-24, 40): `navigator.serviceWorker`, `navigator.userAgent` (Push notifications).
- `src/components/InstallPrompt.jsx` (Lines 7-8): `navigator.userAgent`, `navigator.standalone` (PWA install prompt).
- `src/pages/Chat.jsx` (Lines 78, 412): `navigator.vibrate`, `navigator.clipboard` (Haptic feedback & clipboard).
- `src/pages/Login.jsx` (Line 35): `navigator.standalone` (PWA display mode check).
- *Assessment*: Standard web API usages unrelated to network status.

### 3.3 Components Requiring Adoption of New R2 Connectivity API
1. **`src/pages/Chat.jsx`**:
   - Currently lacks connectivity checks. Should import `useOnlineStatus()` to disable message sending and hide/pause active Realtime subscriptions when `isOffline` is true.
2. **`src/lib/AuthContext.jsx`**:
   - Should add a subscriber to `subscribeToConnectivity` to re-validate session state when transitioning from offline to online.
3. **`src/pages/Reader.jsx`**:
   - Can be simplified by adopting `useOnlineStatus()` hook instead of repeating manual `checkRealConnectivity()` calls in component logic.

---

## 4. Synthesis & Recommendations for Implementer

1. **Maintain `useOnlineStatus.js` interface**:
   - Interface return `{ isOnline, isOffline, isPhantom, lastChecked, checkNow }` is robust, well-designed, and matches all requirements.
2. **Enhance `AuthContext.jsx` reactive recovery**:
   - Subscribe to connectivity status changes in `AuthContext` to trigger background session re-validation upon returning online.
3. **Integrate R2 Connectivity into `Chat.jsx`**:
   - Use `useOnlineStatus` in `Chat.jsx` to prevent WebSocket error loops and inform the user of offline status in community chat.
