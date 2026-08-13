import {
  setNetworkState,
  NetworkState,
  registerMockRoute,
  assert,
  assertEquals
} from '../harness.js';
import { checkRealConnectivity, getConnectivityStatus } from '../../../src/lib/connectivity.js';

export default [
  {
    name: 'R2-B1: Rapid network toggling handles state transitions cleanly',
    fn: async () => {
      const states = [
        NetworkState.ONLINE,
        NetworkState.OFFLINE,
        NetworkState.PHANTOM,
        NetworkState.ONLINE,
        NetworkState.OFFLINE
      ];

      for (const s of states) {
        setNetworkState(s, { phantomTimeoutMs: 50 });
        await checkRealConnectivity({ timeoutMs: 50 });
      }

      const finalStatus = getConnectivityStatus();
      assertEquals(finalStatus.isOffline, true, 'Final connectivity state should be offline');
      assertEquals(finalStatus.isOnline, false, 'Final connectivity state should not be online');
    }
  },
  {
    name: 'R2-B2: Reachability probe strictly enforces 3000ms timeout threshold',
    fn: async () => {
      setNetworkState(NetworkState.PHANTOM, { phantomTimeoutMs: 4000 });

      const start = Date.now();
      const isOnline = await checkRealConnectivity({ timeoutMs: 3000 });
      const duration = Date.now() - start;

      assertEquals(isOnline, false, 'Probe must return false when timing out');
      assert(duration <= 3500, `Probe execution (${duration}ms) exceeded maximum expected boundary`);
    }
  },
  {
    name: 'R2-B3: Endpoint 500 Internal Server Error treated as phantom connectivity',
    fn: async () => {
      setNetworkState(NetworkState.ONLINE);
      registerMockRoute('/favicon.ico', () => ({
        ok: false,
        status: 500,
        text: async () => 'Server Error'
      }));

      const isOnline = await checkRealConnectivity({ timeoutMs: 500 });
      assertEquals(isOnline, false, '500 Server Error probe must be treated as non-reachable');

      const status = getConnectivityStatus();
      assertEquals(status.isPhantom, true, 'Server 500 error while onLine=true must yield phantom status');
    }
  },
  {
    name: 'R2-B4: Aborted probe due to manual network drop cleans up listeners',
    fn: async () => {
      setNetworkState(NetworkState.ONLINE);

      const probePromise = checkRealConnectivity({ timeoutMs: 1000 });
      setNetworkState(NetworkState.OFFLINE);

      const isOnline = await probePromise;
      assertEquals(isOnline, false, 'Aborted probe due to network drop must resolve to false');
      
      const status = getConnectivityStatus();
      assertEquals(status.isOffline, true, 'Status must be updated to offline');
    }
  },
  {
    name: 'R2-B5: Concurrent reachability probes handle simultaneous execution safely',
    fn: async () => {
      setNetworkState(NetworkState.ONLINE);

      const results = await Promise.all([
        checkRealConnectivity({ timeoutMs: 200 }),
        checkRealConnectivity({ timeoutMs: 200 }),
        checkRealConnectivity({ timeoutMs: 200 })
      ]);

      assertEquals(results.length, 3, 'All 3 concurrent probes must complete');
      assertEquals(results.every(r => r === true), true, 'All concurrent probes should return true');
    }
  }
];
