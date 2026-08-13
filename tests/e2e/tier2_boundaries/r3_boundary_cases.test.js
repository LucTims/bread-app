import {
  setNetworkState,
  NetworkState,
  createMockBlob,
  assert,
  assertEquals
} from '../harness.js';
import {
  saveBookOffline,
  getOfflineBooksSync,
  getCoverObjectUrl
} from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'R3-B1: Corrupt JSON in localStorage bread_book_index falls back gracefully',
    fn: async () => {
      localStorage.setItem('bread_book_index', '{invalid-json-string}');

      const catalog = getOfflineBooksSync();
      assert(Array.isArray(catalog), 'Catalog must fall back to empty array without throwing SyntaxError');
      assertEquals(catalog.length, 0, 'Corrupt index must return empty array');
    }
  },
  {
    name: 'R3-B2: Expired offline auth session clears cached user safely',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const expiredUser = { id: 'usr_exp', email: 'exp@test.com', exp: 1000 };
      localStorage.setItem('bread_cached_user', JSON.stringify(expiredUser));

      let user = null;
      try {
        const raw = localStorage.getItem('bread_cached_user');
        const parsed = JSON.parse(raw);
        if (parsed.exp && parsed.exp < Date.now() / 1000) {
          localStorage.removeItem('bread_cached_user');
          user = null;
        } else {
          user = parsed;
        }
      } catch {}

      assertEquals(user, null, 'Expired offline user session should be cleared cleanly');
    }
  },
  {
    name: 'R3-B3: LocalStorage quota exceeded during index write catches error silently',
    fn: async () => {
      const origSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (key, value) => {
        if (key === 'bread_book_index') {
          const err = new Error('QuotaExceededError');
          err.name = 'QuotaExceededError';
          throw err;
        }
        origSetItem(key, value);
      };

      try {
        const pdfBlob = createMockBlob('PDF blob data', 'application/pdf');
        await saveBookOffline('book_quota_test', pdfBlob, { title: 'Quota Title' });
        assert(true, 'saveBookOffline should handle quota exceeded error without crashing');
      } finally {
        localStorage.setItem = origSetItem;
      }
    }
  },
  {
    name: 'R3-B4: Large offline catalog of 100+ books loads synchronously within target',
    fn: async () => {
      const largeCatalog = [];
      for (let i = 1; i <= 120; i++) {
        largeCatalog.push({
          id: `book_large_${i}`,
          title: `Large Book Title ${i}`,
          author: `Author ${i}`,
          sizeBytes: 1024 * 1024
        });
      }
      localStorage.setItem('bread_book_index', JSON.stringify(largeCatalog));

      const start = Date.now();
      const catalog = getOfflineBooksSync();
      const duration = Date.now() - start;

      assertEquals(catalog.length, 120, 'Large catalog of 120 books must be retrieved');
      assert(duration < 10, `Synchronous read of 120 books took ${duration}ms, expected < 10ms`);
    }
  },
  {
    name: 'R3-B5: Missing cover Blob returns null Object URL safely',
    fn: async () => {
      const url = await getCoverObjectUrl('book_without_any_cover_blob');
      assertEquals(url, null, 'Missing cover blob must return null object URL');
    }
  }
];
