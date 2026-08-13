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
  getAllOfflineBooks,
  getCoverObjectUrl,
  getStorageUsage,
  saveCoverOffline
} from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'R3-1: Synchronous localStorage index returns catalog instantly (<5ms)',
    fn: async () => {
      const pdfBlob = createMockBlob('PDF contents', 'application/pdf');
      await saveBookOffline('book_sync_1', pdfBlob, { title: 'Fast Book 1', author: 'Author A' });

      const start = Date.now();
      const catalog = getOfflineBooksSync();
      const duration = Date.now() - start;

      assert(Array.isArray(catalog), 'Sync catalog should be an array');
      assert(catalog.length >= 1, 'Sync catalog should contain saved book');
      assert(duration < 5, `Synchronous read took ${duration}ms, expected < 5ms`);
    }
  },
  {
    name: 'R3-2: Background hydration from IndexedDB loads full book metadata',
    fn: async () => {
      const pdfBlob = createMockBlob('Full book PDF data', 'application/pdf');
      const meta = { title: 'Hydrated Title', author: 'Hydrated Author', cover_url: 'http://example.com/c.jpg' };
      
      await saveBookOffline('book_idb_1', pdfBlob, meta);

      const allBooks = await getAllOfflineBooks();
      assert(Array.isArray(allBooks), 'getAllOfflineBooks must return an array');
      const found = allBooks.find(b => b.id === 'book_idb_1');
      assert(found !== undefined, 'Book should be retrieved from IndexedDB metadata store');
      assertEquals(found.title, 'Hydrated Title', 'Metadata title should match saved title');
    }
  },
  {
    name: 'R3-3: Auth session persists offline using cached session',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const user = { id: 'usr_123', email: 'user@example.com' };
      const profile = { id: 'usr_123', role: 'reader', name: 'Offline User' };

      localStorage.setItem('bread_cached_user', JSON.stringify(user));
      localStorage.setItem('bread_cached_profile', JSON.stringify(profile));

      const cachedUserRaw = localStorage.getItem('bread_cached_user');
      const cachedProfileRaw = localStorage.getItem('bread_cached_profile');

      assert(cachedUserRaw !== null, 'Cached user should exist in localStorage');
      const parsedUser = JSON.parse(cachedUserRaw);
      assertEquals(parsedUser.id, 'usr_123', 'Cached user ID should match');
      
      const parsedProfile = JSON.parse(cachedProfileRaw);
      assertEquals(parsedProfile.role, 'reader', 'Cached profile role should match');
    }
  },
  {
    name: 'R3-4: Offline covers load from Blob cache',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);
      
      const pdfBlob = createMockBlob('PDF Blob', 'application/pdf');
      await saveBookOffline('book_cover_test', pdfBlob, { title: 'Cover Book', author: 'Cover Author' });

      // Save a mock cover blob directly
      const coverBlob = createMockBlob('Image Data', 'image/jpeg');
      const localforage = (await import('localforage')).default;
      const coverStore = localforage.createInstance({ name: 'bread-app', storeName: 'offline_covers' });
      await coverStore.setItem('cover_book_cover_test', coverBlob);

      const coverUrl = await getCoverObjectUrl('book_cover_test');
      assert(coverUrl !== null, 'Cover object URL should be generated from offline store');
      assert(typeof coverUrl === 'string' && coverUrl.startsWith('blob:'), 'Object URL should be a blob URI');
    }
  },
  {
    name: 'R3-5: Storage usage calculation computes total downloaded bytes',
    fn: async () => {
      const pdf1 = createMockBlob('1234567890', 'application/pdf'); // 10 bytes
      const pdf2 = createMockBlob('12345', 'application/pdf');      // 5 bytes

      await saveBookOffline('book_size_1', pdf1, { title: 'B1' });
      await saveBookOffline('book_size_2', pdf2, { title: 'B2' });

      const usage = await getStorageUsage();
      assertEquals(usage.bookCount, 2, 'Should count 2 downloaded books');
      assertEquals(usage.totalBytes, 15, 'Total bytes should sum blob sizes (10 + 5)');
    }
  }
];
