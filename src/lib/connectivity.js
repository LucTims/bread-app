/**
 * Real Connectivity Detection System (R2 Requirement)
 * Combines navigator.onLine with reachability probing to accurately classify:
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
    // Notify subscribers
    _subscribers.forEach(cb => {
      try { cb({ ..._lastKnownStatus }); } catch (err) { console.error('[Connectivity] Listener error:', err); }
    });

    // Dispatch global custom event
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
 * - timeoutMs: fetch timeout in milliseconds (default 2500ms, capped <= 3000ms)
 * - pingUrl: URL to probe (default /favicon.ico)
 * 
 * Returns Promise<boolean>: true if truly online and reachable, false otherwise.
 */
export async function checkRealConnectivity(options = {}) {
  const timeoutMs = Math.min(options.timeoutMs ?? 2500, 3000);
  const defaultPingUrl = import.meta.env.VITE_SUPABASE_URL 
    ? `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health` 
    : '/favicon.svg';
  const pingUrl = options.pingUrl ?? defaultPingUrl;

  // If modem/hardware reports offline, set Truly Offline status immediately without network call
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
      method: 'GET',
      cache: 'no-store',
      headers: { 
        'Cache-Control': 'no-cache',
        ...(import.meta.env.VITE_SUPABASE_ANON_KEY ? { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY } : {})
      }
    };
    if (controller) {
      fetchOpts.signal = controller.signal;
    }

    // Tick to allow hardware event loop processing
    await new Promise(r => setTimeout(r, 10));

    // Re-check hardware state before network dispatch
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (timerId) clearTimeout(timerId);
      updateStatus({ isOnline: false, isOffline: true, isPhantom: false });
      return false;
    }

    const response = await fetch(url, fetchOpts);
    if (timerId) clearTimeout(timerId);

    // Re-check hardware state after fetch completes
    const isHardwareOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
    if (!isHardwareOnline) {
      updateStatus({ isOnline: false, isOffline: true, isPhantom: false });
      return false;
    }

    const isReachable = response.ok || (response.status >= 200 && response.status < 500);
    if (isReachable) {
      updateStatus({ isOnline: true, isOffline: false, isPhantom: false });
      return true;
    } else {
      // Non-2xx/3xx response (e.g., HTTP 500) while navigator.onLine is true => Phantom Connectivity
      updateStatus({ isOnline: false, isOffline: false, isPhantom: true });
      return false;
    }
  } catch (err) {
    if (timerId) clearTimeout(timerId);
    // Timeout or network error while navigator.onLine is true => Phantom Connectivity
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
 * Get current connectivity status synchronously
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

  // Immediately invoke with current state
  try {
    callback({ ..._lastKnownStatus });
  } catch (err) {
    console.error('[Connectivity] Initial callback error:', err);
  }

  return () => {
    _subscribers.delete(callback);
  };
}

// Alias for backward compatibility
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

