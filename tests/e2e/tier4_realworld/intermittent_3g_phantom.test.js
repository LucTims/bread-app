import {
  setNetworkState,
  NetworkState,
  assert,
  assertEquals
} from '../harness.js';
import { checkRealConnectivity, getConnectivityStatus } from '../../../src/lib/connectivity.js';
import { getOfflineBooksSync } from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'RealWorld 4: Intermittent 3G phantom connection (100% loss -> 3s timeout fallback -> UI unblocked)',
    fn: async () => {
      // Seed fast local index
      const localCatalog = [{ id: 'b_3g', title: 'Slow 3G Book', author: 'Author 3G' }];
      localStorage.setItem('bread_book_index', JSON.stringify(localCatalog));

      // Step 1: Simulate 3G network with 100% packet loss (phantom connection)
      setNetworkState(NetworkState.PHANTOM, { phantomTimeoutMs: 3000 });

      // Step 2: Attempt network connectivity check
      const start = Date.now();
      const isOnline = await checkRealConnectivity({ timeoutMs: 3000 });
      const duration = Date.now() - start;

      // Step 3: Probe completes at 3s timeout with phantom offline status
      assertEquals(isOnline, false, '3G phantom connection correctly falls back to offline');
      assert(duration <= 3500, `Probe completed within timeout (${duration}ms)`);

      const status = getConnectivityStatus();
      assertEquals(status.isPhantom, true, 'Status correctly recorded as phantom connectivity');

      // Step 4: UI unblocks immediately, rendering cached local catalog
      const catalog = getOfflineBooksSync();
      assertEquals(catalog.length, 1, 'UI unblocked and rendered local catalog without error');
      assertEquals(catalog[0].title, 'Slow 3G Book', 'Rendered book title matches');
    }
  }
];
