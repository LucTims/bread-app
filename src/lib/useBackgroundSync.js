import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import useOnlineStatus from './useOnlineStatus';
import { flushSyncQueue } from './offlineStore';
import { supabase } from './supabase';

export function useBackgroundSync() {
  const { isOnline } = useOnlineStatus();
  const { user } = useAuth();
  const prevOnlineRef = useRef(isOnline);
  const prevUserRef = useRef(user);

  const triggerSync = useCallback(() => {
    flushSyncQueue(supabase).catch(err => {
      console.error('[BackgroundSync] Error during queue flush:', err);
    });
  }, []);

  // 1. Initial mount check: if isOnline, trigger flushSyncQueue(supabase)
  useEffect(() => {
    if (isOnline) {
      triggerSync();
    }
  }, []);

  // 2. Reconnection check: transition isOnline && !prevOnlineRef.current triggers flushSyncQueue(supabase)
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      triggerSync();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, triggerSync]);

  // 3. Post-auth check: transition user && !prevUserRef.current triggers flushSyncQueue(supabase)
  useEffect(() => {
    if (user && !prevUserRef.current) {
      if (isOnline) {
        triggerSync();
      }
    }
    prevUserRef.current = user;
  }, [user, isOnline, triggerSync]);

  // 4. Event listener for window 'connectivity-changed' custom event (evt?.detail?.isOnline === true)
  useEffect(() => {
    const handleConnectivityChanged = (evt) => {
      if (evt?.detail?.isOnline === true) {
        triggerSync();
      }
    };
    window.addEventListener('connectivity-changed', handleConnectivityChanged);
    return () => {
      window.removeEventListener('connectivity-changed', handleConnectivityChanged);
    };
  }, [triggerSync]);

  return { triggerSync };
}

export default useBackgroundSync;
