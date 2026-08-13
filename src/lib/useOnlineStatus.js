import { useState, useEffect, useCallback } from 'react';
import { getConnectivityStatus, subscribeToConnectivity, checkRealConnectivity } from './connectivity';

export function useOnlineStatus() {
  const [status, setStatus] = useState(() => getConnectivityStatus());

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeToConnectivity((newStatus) => {
      if (mounted) {
        setStatus(newStatus);
      }
    });

    // Freshness check on mount
    checkRealConnectivity();

    return () => {
      mounted = false;
      unsubscribe();
    };
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
