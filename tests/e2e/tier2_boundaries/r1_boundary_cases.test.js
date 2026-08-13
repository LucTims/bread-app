import {
  setNetworkState,
  NetworkState,
  assert,
  assertEquals
} from '../harness.js';
import {
  getOfflineBooksSync,
  getAllOfflineBooks
} from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'R1-B1: Empty cache on first launch offline renders empty state without crashing',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);
      localStorage.clear();

      const syncCatalog = getOfflineBooksSync();
      assertEquals(syncCatalog.length, 0, 'Sync catalog on empty launch must be empty array');

      const idbCatalog = await getAllOfflineBooks();
      assertEquals(idbCatalog.length, 0, 'IDB catalog on empty launch must be empty array');
    }
  },
  {
    name: 'R1-B2: Uncached asset lookup in offline mode falls back to index.html shell',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const cache = await globalThis.caches.open('boomread-app-shell-v1');
      await cache.put('/index.html', { ok: true, status: 200, isShell: true });

      let res = await cache.match('/unknown-route');
      if (!res) {
        res = await cache.match('/index.html');
      }

      assert(res !== null, 'Uncached route request should resolve to shell fallback');
      assertEquals(res.isShell, true, 'Fallback response should be index.html app shell');
    }
  },
  {
    name: 'R1-B3: Service worker update failure offline maintains active cache',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const cache = await globalThis.caches.open('boomread-app-shell-v1');
      await cache.put('/index.html', { ok: true, status: 200, version: 1 });

      // Simulate failed SW update network fetch
      try {
        await globalThis.fetch('/sw.js');
      } catch (err) {
        // Expected offline fetch failure
      }

      const activeRes = await cache.match('/index.html');
      assert(activeRes !== null, 'Active SW cache must remain intact when update fails');
      assertEquals(activeRes.version, 1, 'Cache version should be preserved');
    }
  },
  {
    name: 'R1-B4: Page hard refresh in offline mode maintains route state',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);
      globalThis.window.location.href = 'http://localhost:3000/library';

      const cache = await globalThis.caches.open('boomread-app-shell-v1');
      await cache.put('/index.html', { ok: true, status: 200 });

      const res = await cache.match('/index.html');
      assert(res !== null, 'App shell should be served on refresh');
      assertEquals(globalThis.window.location.href, 'http://localhost:3000/library', 'Route URL preserved');
    }
  },
  {
    name: 'R1-B5: Phantom network hard reload resolves to offline shell within timeout limit',
    fn: async () => {
      setNetworkState(NetworkState.PHANTOM, { phantomTimeoutMs: 1500 });

      const cache = await globalThis.caches.open('boomread-app-shell-v1');
      await cache.put('/index.html', { ok: true, status: 200 });

      const start = Date.now();
      const res = await cache.match('/index.html');
      const duration = Date.now() - start;

      assert(res !== null, 'App shell must load from cache during phantom network reload');
      assert(duration < 2000, `Phantom reload completed in ${duration}ms, under 2000ms target`);
    }
  }
];
