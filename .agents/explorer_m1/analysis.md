# Technical Design Specification: Real Connectivity Detection System (R2)

## 1. Executive Summary

The **Real Connectivity Detection System (R2)** replaces unreliable browser `navigator.onLine` checks across the BoomRead application (`bread-app`) with active HTTP reachability probing. 

Standard `navigator.onLine` only checks whether local network interfaces (WiFi or cellular modem) are active. In real-world mobile environments—such as captive portals, weak cellular data, airplane mode with active local WiFi, or server outages—`navigator.onLine` reports `true` despite complete internet unreachability ("phantom connectivity"). This causes the app shell to hang when attempting network requests (e.g., Supabase auth session initialization or database fetches) rather than gracefully dropping into offline mode with local IndexedDB/localStorage data.

R2 solves this by pairing passive network state monitoring with lightweight HTTP ping probing to `/favicon.svg`. It accurately classifies connectivity into three states:
1. **Truly Online** (`isOnline: true`, `isOffline: false`, `isPhantom: false`)
2. **Truly Offline** (`isOnline: false`, `isOffline: true`, `isPhantom: false`)
3. **Phantom Connectivity** (`isOnline: false`, `isOffline: true`, `isPhantom: true`)

Crucially, both **Truly Offline** and **Phantom Connectivity** evaluate `isOffline: true`, enabling unified, deterministic offline fallback across all 13 identified locations in the app.

---

## 2. Comprehensive Audit of Current `navigator.onLine` Usage (13 Locations)

A exhaustive audit across `src/` identified **13 distinct occurrences** of `navigator.onLine`. All 13 will be refactored to use either the `useOnlineStatus` hook (for reactive UI components) or `checkRealConnectivity` (for async imperative functions).

| # | File | Line | Context / Function | Current Behavior | Defect / Failure Mode | Proposed Refactoring |
|---|------|------|-------------------|------------------|----------------------|----------------------|
| 1 | `src/App.jsx` | 28 | `ProtectedRoute` | `useState(!navigator.onLine)` + `window.onOnline/onOffline` | Phantom data causes `isOffline` to be `false`; loading spinner hangs indefinitely awaiting auth. | Replace state/listeners with `useOnlineStatus()`. |
| 2 | `src/components/TopBar.jsx` | 16 | `useEffect` for streak | `if (user && navigator.onLine)` | If phantom network exists, attempts Supabase profile read which fails/hangs. | Replace check with `const { isOnline } = useOnlineStatus()` and condition `if (user && isOnline)`. |
| 3 | `src/lib/AuthContext.jsx` | 77 | `init()` auth session | `if (!navigator.onLine)` | Phantom connection bypasses cached auth logic and executes hanging `supabase.auth.getSession()`. | Replace check with `const status = await checkRealConnectivity(); if (status.isOffline)`. |
| 4 | `src/pages/AIChat.jsx` | 25 | `useEffect` fetch online books | `if (!user \|\| !navigator.onLine) return;` | Phantom network causes attempted fetch of Supabase book access rows. | Replace with `const { isOnline } = useOnlineStatus()` inside component, `if (!user \|\| !isOnline) return;`. |
| 5 | `src/pages/AIChat.jsx` | 116 | `sendMessage` | `if (!navigator.onLine)` | Phantom network allows AI message submission, triggering failing Gemini API request. | Replace with `const status = await checkRealConnectivity(); if (status.isOffline)`. |
| 6 | `src/pages/Home.jsx` | 12 | Root component render | `const isOffline = !navigator.onLine;` | Static check on mount; does not react to phantom connectivity or mid-session changes. | Replace with `const { isOffline } = useOnlineStatus()`. |
| 7 | `src/pages/Home.jsx` | 58 | `loadData` callback | `if (!navigator.onLine)` | Attempts Supabase query when network is phantom, causing slow loading timeouts. | Use `isOffline` from `useOnlineStatus()` or `checkRealConnectivity()`. |
| 8 | `src/pages/Library.jsx` | 29 | Root component render | `const isOfflineNow = !navigator.onLine;` | Synchronous check on mount misses phantom connectivity. | Replace with `const { isOffline: isOfflineNow } = useOnlineStatus()`. |
| 9 | `src/pages/Library.jsx` | 45 | `isOfflineMode` Ref & `useEffect` | `const isOfflineMode = useRef(!navigator.onLine);` | Uses standard window `online`/`offline` listeners; ignores phantom state. | Remove custom event listeners; update ref from `useOnlineStatus()`. |
| 10 | `src/pages/Library.jsx` | 76 | `useEffect` load books | `if (!navigator.onLine)` | Tries online Supabase query during phantom connection. | Use `isOfflineNow` from `useOnlineStatus()`. |
| 11 | `src/pages/Reader.jsx` | 90 | `sendReadingStats` | `if (!navigator.onLine)` | Attempts RPC call during phantom connection, failing before fallback queue. | Replace with `const status = await checkRealConnectivity(); if (status.isOffline)`. |
| 12 | `src/pages/Reader.jsx` | 161 | `loadBook` | `if (!navigator.onLine)` | Throws online error during phantom connection instead of handling gracefully. | Replace with `const status = await checkRealConnectivity(); if (status.isOffline)`. |
| 13 | `src/pages/Reader.jsx` | 240 | `useEffect` init offline reader | `if (!navigator.onLine)` | Skips instant offline PDF blob loading when phantom connection is active. | Replace with `const status = await checkRealConnectivity(); if (status.isOffline)`. |

---

## 3. Module Architecture Specification: `src/lib/connectivity.js`

### 3.1 Core State Representation

```typescript
interface ConnectivityStatus {
  isOnline: boolean;   // true ONLY if server probe succeeds
  isOffline: boolean;  // true if navigator.onLine === false OR server probe fails
  isPhantom: boolean;  // true if navigator.onLine === true BUT server probe fails
  lastChecked: number; // Unix timestamp (ms) of last probe check
}
```

State Mapping Truth Table:

| `navigator.onLine` | HTTP Probe (`/favicon.svg`) | `isOnline` | `isOffline` | `isPhantom` | Description |
|--------------------|----------------------------|------------|-------------|-------------|-------------|
| `false`            | *Skipped* (Not attempted)  | `false`    | `true`      | `false`     | Truly Offline (Hardware/Modem disabled) |
| `true`             | 200 OK (Received in <=2.5s) | `true`     | `false`     | `false`     | Truly Online |
| `true`             | Error / Timeout (>2.5s)    | `false`    | `true`      | `true`      | Phantom Connectivity (Modem on, internet unreachable) |

### 3.2 Active HTTP Probing Mechanism

1. **Probe Endpoint**: `/favicon.svg` (Static asset already present in `/public/favicon.svg`, served locally in PWA / dev server with zero backend overhead).
2. **Cache Busting**: Append timestamp query string `?_t=${Date.now()}` to prevent browser HTTP cache or service worker cache hits from returning stale false positives.
3. **Fetch Options**:
   - `method: 'HEAD'` (or fallback to `GET` if HEAD is blocked by SW). `HEAD` fetches only headers (0 byte body transfer).
   - `cache: 'no-store'`
   - `mode: 'cors'` (or `'no-cors'` if cross-origin, but local endpoint is same-origin).
4. **Timeout Enforcement**:
   - `AbortController` configured with `setTimeout(..., 2500)` (2.5 seconds timeout).
   - Aborts fetch if request exceeds 2500ms.

```javascript
// Internal probe runner in src/lib/connectivity.js
async function probeEndpoint(timeoutMs = 2500) {
  if (!navigator.onLine) return false;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(`/favicon.svg?_t=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok || response.status < 400;
  } catch (err) {
    clearTimeout(timeoutId);
    return false;
  }
}
```

### 3.3 Event-Driven & Periodic Health Checks

To ensure network status changes are detected and broadcast within **5 seconds**:
1. **Window Events**:
   - `'online'`: Immediately triggers `checkRealConnectivity({ forceProbe: true })`.
   - `'offline'`: Immediately sets `state = { isOnline: false, isOffline: true, isPhantom: false }` and broadcasts.
   - `'focus'` / `'visibilitychange'`: Triggers probe check if last check was > 5000ms ago.
2. **Periodic Health Check**:
   - Background `setInterval` running every **5000ms** (5s).
   - Performs lightweight probe to verify ongoing reachability.
3. **State Change Deduplication**:
   - Only triggers listener callbacks if state transitions occur (`isOnline`, `isOffline`, or `isPhantom` changes value).

### 3.4 Exported Module API

```javascript
/**
 * Synchronously returns the last known connectivity status state.
 * @returns {ConnectivityStatus}
 */
export function getConnectivityStatus();

/**
 * Executes a real connectivity check (HTTP probe if navigator.onLine is true).
 * Updates internal state and notifies subscribers if state changed.
 * @param {{ forceProbe?: boolean, timeoutMs?: number }} options
 * @returns {Promise<ConnectivityStatus>}
 */
export function checkRealConnectivity(options = {});

/**
 * Subscribes a listener to connectivity status updates.
 * @param {(status: ConnectivityStatus) => void} callback
 * @returns {() => void} Unsubscribe cleanup function
 */
export function subscribeToConnectivity(callback);
```

---

## 4. React Hook Specification: `src/lib/useOnlineStatus.js`

### 4.1 Architecture & Implementation

`useOnlineStatus` wraps `src/lib/connectivity.js` using `useSyncExternalStore` (or `useState` + `useEffect`) to ensure zero visual tearing and optimal re-rendering performance.

```javascript
import { useState, useEffect } from 'react';
import { getConnectivityStatus, subscribeToConnectivity, checkRealConnectivity } from './connectivity';

export function useOnlineStatus() {
  const [status, setStatus] = useState(getConnectivityStatus);

  useEffect(() => {
    // Subscribe to state updates
    const unsubscribe = subscribeToConnectivity((newStatus) => {
      setStatus(newStatus);
    });

    // Run immediate freshness check on mount
    checkRealConnectivity();

    return unsubscribe;
  }, []);

  return {
    ...status,
    checkNow: checkRealConnectivity
  };
}
```

---

## 5. Detailed Refactoring Specifications for all 13 Locations

### Location 1: `src/App.jsx` (Lines 28-53)
- **Target**: `ProtectedRoute` component
- **Changes**:
  - Replace `const [isOffline, setIsOffline] = useState(!navigator.onLine);` and window listener `useEffect` with `const { isOffline, isOnline } = useOnlineStatus();`.
  - Maintain the offline reading stats flush logic when transitioning to `isOnline === true`.

### Location 2: `src/components/TopBar.jsx` (Lines 16-22)
- **Target**: Streak fetching `useEffect`
- **Changes**:
  - Add `const { isOnline } = useOnlineStatus();`
  - Update condition: `if (user && isOnline)` with dependency `[user, isOnline]`.

### Location 3: `src/lib/AuthContext.jsx` (Lines 77-91)
- **Target**: `init()` auth initialization routine
- **Changes**:
  - Import `checkRealConnectivity` from `./connectivity`.
  - Replace `if (!navigator.onLine)` with:
    ```javascript
    const conn = await checkRealConnectivity();
    if (conn.isOffline) {
        // Fast offline session restore logic
    }
    ```

### Locations 4 & 5: `src/pages/AIChat.jsx` (Lines 25 & 116)
- **Target**: `fetchOnlineBooks` useEffect (line 25) & `sendMessage` handler (line 116)
- **Changes**:
  - Add `const { isOnline, isOffline } = useOnlineStatus();` at top of `AIChat`.
  - Line 25: `if (!user || !isOnline) return;` with `[user, isOnline]`.
  - Line 116: Replace `if (!navigator.onLine)` with `const conn = await checkRealConnectivity(); if (conn.isOffline)`.

### Locations 6 & 7: `src/pages/Home.jsx` (Lines 12 & 58)
- **Target**: Component root state (line 12) & `loadData` function (line 58)
- **Changes**:
  - Replace `const isOffline = !navigator.onLine;` with `const { isOffline } = useOnlineStatus();`.
  - Line 58 inside `loadData`: `if (isOffline) { ... return; }` automatically uses reactive `isOffline`.

### Locations 8, 9 & 10: `src/pages/Library.jsx` (Lines 29, 45, 76)
- **Target**: Component root render (line 29), ref/listeners (line 45), load books useEffect (line 76)
- **Changes**:
  - Replace `const isOfflineNow = !navigator.onLine;` with `const { isOffline: isOfflineNow, isOnline } = useOnlineStatus();`.
  - Remove manual `window.addEventListener('online'/'offline')` from line 48. Keep `isOfflineMode.current = isOfflineNow;`.
  - Line 76: `if (isOfflineNow) { ... }`.

### Locations 11, 12 & 13: `src/pages/Reader.jsx` (Lines 90, 161, 240)
- **Target**: `sendReadingStats` (line 90), `loadBook` (line 161), reader init useEffect (line 240)
- **Changes**:
  - Line 90: `const status = await checkRealConnectivity(); if (status.isOffline) { await enqueueReadingStats(...); return; }`
  - Line 161: `const status = await checkRealConnectivity(); if (status.isOffline) { throw new Error("Ce livre n'est pas téléchargé et vous n'avez pas de connexion Internet."); }`
  - Line 240: `const status = await checkRealConnectivity(); if (status.isOffline) { ... }`

---

## 6. Verification and Invalidation Strategy

### 6.1 Verification Commands & Manual Test Protocol
1. **Lint / Build Verification**:
   - Command: `npm run build` or `npx vite build` to ensure no syntax errors or unresolved imports.
2. **DevTools Phantom Network Testing**:
   - Open Chrome DevTools -> Network tab.
   - Scenario A: Set throttling to **Offline**. `navigator.onLine` becomes `false`. System reports `isOffline: true`, `isPhantom: false`.
   - Scenario B (Phantom Connectivity): Keep `navigator.onLine = true` (Online mode in DevTools), but add Request Blocking rule for `*` or block `/favicon.svg*` / `ezmchxokfeybpccmkhyx.supabase.co`.
   - Result: HTTP probe fails within 2.5s. System reports `isOffline: true`, `isPhantom: true`. The application instantly falls back to IndexedDB/localStorage data without hanging.

### 6.2 Invalidation Conditions
- Probe endpoint `/favicon.svg` returned 404 or missing: Ensure `/public/favicon.svg` exists and is included in PWA assets.
- Timeout too short: 2500ms allows sufficient buffer for 3G/4G network latency while remaining fast enough to prevent perceived UI freezes.
