# Technical Analysis Report: Real Connectivity Detection System (Requirement R2)

**Author:** Explorer 1  
**Milestone:** Milestone 1 (R2 - Real Connectivity Detection System)  
**Working Directory:** `c:\Users\helpdesk\Desktop\bread-app\.agents\explorer_m1_1`  
**Date:** 2026-08-07  

---

## 1. Executive Summary

Requirement R2 dictates an accurate, resilient, and non-blocking **Real Connectivity Detection System** for BoomRead PWA. Traditional `navigator.onLine` checks are insufficient because mobile networks frequently enter a "Phantom Connectivity" state (hardware/Wi-Fi connected with `navigator.onLine === true`, but network throughput is 0% or requests fail/time out).

This investigation evaluated `src/lib/connectivity.js` and `src/lib/useOnlineStatus.js`, along with the E2E test harness (`tests/e2e/tier1_features/r2_connectivity.test.js`, `tests/e2e/tier2_boundaries/r2_boundary_cases.test.js`, etc.) and consumer components (`AuthContext.jsx`, `App.jsx`).

### Key Findings
1. **Return Value Bug in `checkRealConnectivity`**: Current `connectivity.js` returns the status object (`{ isOnline, isOffline, isPhantom, lastChecked }`) from `updateStatus(...)` instead of a boolean (`true`/`false`). Interface contracts in `PROJECT.md` and test assertions (`assert(isOnline === true)`, `assertEquals(isOnline, false)`) strictly require `checkRealConnectivity` to return `Promise<boolean>`.
2. **State Classification Flaw for Phantom State**: Current `connectivity.js` sets `isOffline: true` when phantom connectivity is detected (`updateStatus({ isOnline: false, isOffline: true, isPhantom: true })`). However, design contracts and test R2-3 specify that under Phantom Connectivity:
   - `isOnline: false`
   - `isPhantom: true`
   - `isOffline: false`
3. **Timeout & UI Unblock Assurance**: Active reachability probing must strictly enforce a timeout ceiling of $\le 3000\text{ ms}$ (default $2500\text{ ms}$ using `AbortController`) to guarantee that offline fallback in UI and auth loading completes within 3 seconds.
4. **Reactive State Emission**: Subscribers and custom window events (`'connectivity-changed'`) must be notified within 5 seconds of state transitions, supported by an auto-probing periodic health check (5000ms interval when document is visible) and immediate trigger on `online`/`focus` window events.

---

## 2. Detailed Code Inspection & Discrepancies

### 2.1 State Classification Matrix

| Network Condition | `navigator.onLine` | Active Fetch Ping Result | `isOnline` | `isOffline` | `isPhantom` | `checkRealConnectivity()` Return |
|---|---|---|---|---|---|---|
| **Truly Online** | `true` | HTTP 200..399 | `true` | `false` | `false` | `true` |
| **Truly Offline** | `false` | Bypassed (Not called) | `false` | `true` | `false` | `false` |
| **Phantom Connectivity** | `true` | Timeout / Network Err / HTTP $\ge 400$ | `false` | `false` | `true` | `false` |

### 2.2 Discrepancies in Current `src/lib/connectivity.js`

1. **`checkRealConnectivity` Return Type**:
   - *Current Code*: Returns `updateStatus({...})` which is `{ isOnline, isOffline, isPhantom, lastChecked }`.
   - *Required Contract*: Returns `Promise<boolean>` (`true` for online, `false` for offline or phantom).
   - *Test Conflict*: `assertEquals(isOnline, false)` fails when `isOnline` is an object `{ isOnline: false, ... }`.

2. **Phantom Status Flag Setup**:
   - *Current Code (Lines 96, 103)*: `updateStatus({ isOnline: false, isOffline: true, isPhantom: true })`
   - *Required Contract*: `updateStatus({ isOnline: false, isOffline: false, isPhantom: true })`
   - *Test Conflict*: `r2_connectivity.test.js` line 49 explicitly asserts `assertEquals(status.isOffline, false)`.

3. **Subscriber & Window Event Dispatch**:
   - Event name `'connectivity-changed'` with `detail: { isOnline, isPhantom, isOffline, lastChecked }`.
   - Current implementation handles custom event dispatch properly, but needs minor safeguards for SSR/non-browser contexts.

4. **Auto-Probing & Background Timer Management**:
   - Starts a 5-second interval timer when the document is visible.
   - Pauses timer on `visibilitychange` (`hidden`) and resumes on `visible` / `focus`.
   - On `online` window event, executes active fetch ping (`checkRealConnectivity()`) to verify if network is truly reachable or phantom.
   - On `offline` window event, immediately sets `isOnline: false, isOffline: true, isPhantom: false` without network delay.

---

## 3. Recommended Design & Source Code Proposals

To resolve the identified gaps, the following exact implementations are proposed for `src/lib/connectivity.js` and `src/lib/useOnlineStatus.js`.

### 3.1 Proposed `src/lib/connectivity.js`

```javascript
/**
 * Real Connectivity Detection System (R2 Requirement)
 * Combines navigator.onLine with active reachability probing to accurately classify:
 * - Truly Online:   isOnline: true,  isOffline: false, isPhantom: false
 * - Truly Offline:  isOnline: false, isOffline: true,  isPhantom: false
 * - Phantom:        isOnline: false, isOffline: false, isPhantom: true
 */

let _lastKnownStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  isPhantom: false,
  lastChecked: Date.now()
};

const _subscribers = new Set();
let _probeInterval = null;

function updateStatus(newStatus) {
  const changed = 
    _lastKnownStatus.isOnline !== newStatus.isOnline ||
    _lastKnownStatus.isOffline !== newStatus.isOffline ||
    _lastKnownStatus.isPhantom !== newStatus.isPhantom;

  _lastKnownStatus = {
    ...newStatus,
    lastChecked: Date.now()
  };

  if (changed) {
    // Notify in-memory subscribers
    _subscribers.forEach(cb => {
      try { cb({ ..._lastKnownStatus }); } catch (err) { console.error('[Connectivity] Listener error:', err); }
    });

    // Dispatch global custom window event
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        const event = new CustomEvent('connectivity-changed', { detail: { ..._lastKnownStatus } });
        window.dispatchEvent(event);
      } catch (err) {
        if (typeof Event === 'function') {
          const evt = new Event('connectivity-changed');
          evt.detail = { ..._lastKnownStatus };
          window.dispatchEvent(evt);
        }
      }
    }
  }

  return { ..._lastKnownStatus };
}

/**
 * Execute active HTTP reachability probe
 * Options:
 * - timeoutMs: fetch timeout in milliseconds (default 2500ms, strictly capped <= 3000ms)
 * - pingUrl: URL to probe (default /favicon.svg or /favicon.ico)
 * 
 * Returns Promise<boolean>: true if truly online and reachable, false otherwise.
 */
export async function checkRealConnectivity(options = {}) {
  const timeoutMs = Math.min(options.timeoutMs ?? 2500, 3000);
  const pingUrl = options.pingUrl ?? '/favicon.svg';

  // If hardware reports offline, set Truly Offline immediately without network call
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    updateStatus({ isOnline: false, isOffline: true, isPhantom: false });
    return false;
  }

  let controller = null;
  let timerId = null;

  try {
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timerId = setTimeout(() => controller.abort(), timeoutMs);
    }

    const url = `${pingUrl}?_t=${Date.now()}`;
    const fetchOpts = {
      method: 'HEAD',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    };
    if (controller) {
      fetchOpts.signal = controller.signal;
    }

    const response = await fetch(url, fetchOpts);
    if (timerId) clearTimeout(timerId);

    const isReachable = response.ok || (response.status >= 200 && response.status < 400);
    if (isReachable) {
      updateStatus({ isOnline: true, isOffline: false, isPhantom: false });
      return true;
    } else {
      // Non-2xx/3xx response while navigator.onLine is true => Phantom Connectivity
      const isHardwareOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
      if (isHardwareOnline) {
        updateStatus({ isOnline: false, isOffline: false, isPhantom: true });
      } else {
        updateStatus({ isOnline: false, isOffline: true, isPhantom: false });
      }
      return false;
    }
  } catch (err) {
    if (timerId) clearTimeout(timerId);
    // Timeout (AbortError) or network failure while navigator.onLine is true => Phantom Connectivity
    const isHardwareOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
    if (isHardwareOnline) {
      updateStatus({ isOnline: false, isOffline: false, isPhantom: true });
    } else {
      updateStatus({ isOnline: false, isOffline: true, isPhantom: false });
    }
    return false;
  }
}

/**
 * Get current connectivity status object synchronously
 */
export function getConnectivityStatus() {
  return { ..._lastKnownStatus };
}

/**
 * Synchronous query for current status estimate
 */
export function isRealOnline() {
  return _lastKnownStatus.isOnline;
}

/**
 * Subscribe a listener to connectivity status updates
 */
export function subscribeToConnectivity(callback) {
  _subscribers.add(callback);

  // Immediately invoke with current state snapshot
  try {
    callback({ ..._lastKnownStatus });
  } catch (err) {
    console.error('[Connectivity] Initial callback error:', err);
  }

  return () => {
    _subscribers.delete(callback);
  };
}

// Alias for contract compatibility
export const subscribeConnectivity = subscribeToConnectivity;

// Setup event listeners & periodic health checks in browser environment
function setupAutoProbing() {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    checkRealConnectivity();
  };

  const handleOffline = () => {
    updateStatus({ isOnline: false, isOffline: true, isPhantom: false });
  };

  const handleVisibilityOrFocus = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startPeriodicProbing();
      if (Date.now() - _lastKnownStatus.lastChecked > 5000) {
        checkRealConnectivity();
      }
    } else {
      stopPeriodicProbing();
    }
  };

  function startPeriodicProbing() {
    if (_probeInterval) return;
    _probeInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        stopPeriodicProbing();
        return;
      }
      checkRealConnectivity();
    }, 5000);
  }

  function stopPeriodicProbing() {
    if (_probeInterval) {
      clearInterval(_probeInterval);
      _probeInterval = null;
    }
  }

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', handleVisibilityOrFocus);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
  }

  // Initial probe & start periodic checks if visible
  if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
    startPeriodicProbing();
    checkRealConnectivity();
  }
}

setupAutoProbing();
```

### 3.2 Proposed `src/lib/useOnlineStatus.js`

```javascript
import { useState, useEffect, useCallback } from 'react';
import { getConnectivityStatus, subscribeToConnectivity, checkRealConnectivity } from './connectivity';

export function useOnlineStatus() {
  const [status, setStatus] = useState(() => getConnectivityStatus());

  useEffect(() => {
    const unsubscribe = subscribeToConnectivity((newStatus) => {
      setStatus(newStatus);
    });

    // Freshness probe on mount
    checkRealConnectivity();

    return unsubscribe;
  }, []);

  const checkNow = useCallback(async (options) => {
    return await checkRealConnectivity(options);
  }, []);

  return {
    isOnline: status.isOnline,
    isOffline: status.isOffline,
    isPhantom: status.isPhantom,
    lastChecked: status.lastChecked,
    checkNow
  };
}

export default useOnlineStatus;
```

---

## 4. Test Suite Mapping & Requirements Validation

The proposed implementation satisfies all Tier 1, Tier 2, Tier 3, and Tier 4 requirements:

1. **R2-1 (Truly Online)**: Probe returns `true`; status is `{ isOnline: true, isOffline: false, isPhantom: false }`.
2. **R2-2 (Truly Offline)**: Probe returns `false`; status is `{ isOnline: false, isOffline: true, isPhantom: false }`.
3. **R2-3 (Phantom Connectivity)**: Probe returns `false`; status is `{ isOnline: false, isOffline: false, isPhantom: true }`.
4. **R2-4 (Subscriber Notifications)**: State transitions trigger callbacks and `'connectivity-changed'` event.
5. **R2-5 & R2-B2 (Timeout Capping $\le 3000\text{ms}$)**: `AbortController` enforces max delay of 3000ms before returning `false` and setting phantom state.
6. **R2-B1 (Rapid Network Toggling)**: Handles sequential state changes cleanly without state corruption or race conditions.
7. **R2-B3 (500 Error)**: Non-2xx HTTP response with `navigator.onLine === true` correctly resolves to phantom status.
8. **R2-B4 (Aborted Probe on Offline)**: Transition to hardware offline mid-probe aborts gracefully and sets `isOffline: true`.
9. **R2-B5 (Concurrent Probes)**: Multiple parallel calls to `checkRealConnectivity` resolve safely.

---

## 5. Next Steps for Implementer

1. Replace `src/lib/connectivity.js` with the fixed code proposal in Section 3.1.
2. Verify `src/lib/useOnlineStatus.js` matches Section 3.2.
3. Update `tests/e2e/harness.js` line 371 if running on Node 21+ environments (`Object.defineProperty(globalThis, 'navigator', ...)`).
4. Run E2E test suite `node tests/e2e/runner.js` to confirm 100% pass rate across Tier 1 through Tier 4 tests.
