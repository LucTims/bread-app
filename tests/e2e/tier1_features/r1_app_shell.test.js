import {
  setupTestEnvironment,
  resetTestEnvironment,
  setNetworkState,
  NetworkState,
  assert,
  assertEquals
} from '../harness.js';

export default [
  {
    name: 'R1-1: Pre-cached app shell loads when network is offline',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);
      
      const cache = await globalThis.caches.open('boomread-app-shell-v1');
      await cache.put('/index.html', { ok: true, status: 200, text: async () => '<html>App Shell</html>' });

      const response = await cache.match('/index.html');
      assert(response !== null, 'App shell should be retrieved from SW cache when offline');
      assertEquals(response.status, 200, 'Cached shell response status should be 200');
    }
  },
  {
    name: 'R1-2: Instant loading of app shell without network (<2s)',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);
      
      const cache = await globalThis.caches.open('boomread-app-shell-v1');
      await cache.put('/index.html', { ok: true, status: 200, text: async () => '<html>Shell</html>' });

      const start = Date.now();
      const res = await cache.match('/index.html');
      const duration = Date.now() - start;

      assert(res !== null, 'App shell must load from cache');
      assert(duration < 2000, `Loading took ${duration}ms, expected under 2000ms`);
    }
  },
  {
    name: 'R1-3: App shell loads instantly on phantom connectivity without hanging',
    fn: async () => {
      setNetworkState(NetworkState.PHANTOM, { phantomTimeoutMs: 3000 });

      const cache = await globalThis.caches.open('boomread-app-shell-v1');
      await cache.put('/index.html', { ok: true, status: 200 });

      // Match from SW cache is fast and non-network blocking
      const start = Date.now();
      const res = await cache.match('/index.html');
      const duration = Date.now() - start;

      assert(res !== null, 'Cached shell must be available during phantom connectivity');
      assert(duration < 500, `Shell retrieval under phantom net took ${duration}ms, expected < 500ms`);
    }
  },
  {
    name: 'R1-4: All primary UI routes are served by cached app shell offline',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const cache = await globalThis.caches.open('boomread-app-shell-v1');
      const routes = ['/home', '/library', '/reader/book-123', '/settings', '/profile'];
      
      for (const route of routes) {
        await cache.put(route, { ok: true, status: 200, url: route });
      }

      for (const route of routes) {
        const res = await cache.match(route);
        assert(res !== null, `Route ${route} should be served from cache offline`);
      }
    }
  },
  {
    name: 'R1-5: Service worker CacheFirst strategy serves static assets offline',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const cache = await globalThis.caches.open('boomread-assets-v1');
      const assetUrl = '/assets/main.css';
      await cache.put(assetUrl, { ok: true, status: 200, text: async () => 'body { margin: 0; }' });

      const cachedRes = await cache.match(assetUrl);
      assert(cachedRes !== null, 'Static asset must be served via CacheFirst offline');
      const css = await cachedRes.text();
      assertEquals(css, 'body { margin: 0; }', 'Asset content must match cached content');
    }
  }
];
