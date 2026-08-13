import {
  setNetworkState,
  NetworkState,
  assert,
  assertEquals
} from '../harness.js';
import { checkRealConnectivity, getConnectivityStatus, subscribeConnectivity } from '../../../src/lib/connectivity.js';

export default [
  {
    name: 'R2-1: Distinguishes Truly Online state',
    fn: async () => {
      setNetworkState(NetworkState.ONLINE);

      const isOnline = await checkRealConnectivity({ timeoutMs: 1000 });
      assert(isOnline === true, 'checkRealConnectivity should return true when online');

      const status = getConnectivityStatus();
      assertEquals(status.isOnline, true, 'status.isOnline should be true');
      assertEquals(status.isPhantom, false, 'status.isPhantom should be false');
      assertEquals(status.isOffline, false, 'status.isOffline should be false');
    }
  },
  {
    name: 'R2-2: Distinguishes Truly Offline state',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const isOnline = await checkRealConnectivity({ timeoutMs: 1000 });
      assert(isOnline === false, 'checkRealConnectivity should return false when offline');

      const status = getConnectivityStatus();
      assertEquals(status.isOnline, false, 'status.isOnline should be false');
      assertEquals(status.isPhantom, false, 'status.isPhantom should be false');
      assertEquals(status.isOffline, true, 'status.isOffline should be true');
    }
  },
  {
    name: 'R2-3: Distinguishes Phantom Connectivity state',
    fn: async () => {
      setNetworkState(NetworkState.PHANTOM, { phantomTimeoutMs: 50 });

      const isOnline = await checkRealConnectivity({ timeoutMs: 100 });
      assert(isOnline === false, 'checkRealConnectivity should return false for phantom connection');

      const status = getConnectivityStatus();
      assertEquals(status.isOnline, false, 'status.isOnline should be false under phantom connectivity');
      assertEquals(status.isPhantom, true, 'status.isPhantom should be true under phantom connectivity');
      assertEquals(status.isOffline, false, 'status.isOffline should be false');
    }
  },
  {
    name: 'R2-4: Connectivity status subscription emits updates on state changes',
    fn: async () => {
      setNetworkState(NetworkState.ONLINE);
      await checkRealConnectivity({ timeoutMs: 50 });

      let lastEmitted = null;
      const unsubscribe = subscribeConnectivity((status) => {
        lastEmitted = status;
      });

      setNetworkState(NetworkState.OFFLINE);
      await checkRealConnectivity({ timeoutMs: 50 });

      assert(lastEmitted !== null, 'Subscriber should receive status update');
      assertEquals(lastEmitted.isOffline, true, 'Emitted status should be offline');

      unsubscribe();
    }
  },
  {
    name: 'R2-5: Reachability probe timeout caps UI block at <=3 seconds',
    fn: async () => {
      setNetworkState(NetworkState.PHANTOM, { phantomTimeoutMs: 300 });

      const start = Date.now();
      await checkRealConnectivity({ timeoutMs: 500 });
      const duration = Date.now() - start;

      assert(duration <= 3000, `Probe should complete within 3000ms limit (took ${duration}ms)`);
      const status = getConnectivityStatus();
      assertEquals(status.isPhantom, true, 'Should resolve to phantom status');
    }
  }
];
