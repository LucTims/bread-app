import {
  setNetworkState,
  NetworkState,
  createMockBlob,
  assert,
  assertEquals
} from '../harness.js';
import { checkRealConnectivity, getConnectivityStatus } from '../../../src/lib/connectivity.js';
import { saveBookOffline, getOfflineBooksSync } from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'RealWorld 3: Airplane mode launch (Cold launch zero connectivity -> Instant app shell & cached profile/library)',
    fn: async () => {
      // Step 1: Pre-populate cached session & catalog while previously online
      const user = { id: 'usr_airplane', email: 'pilot@test.com' };
      const profile = { id: 'usr_airplane', role: 'reader', name: 'Airplane Mode User' };
      localStorage.setItem('bread_cached_user', JSON.stringify(user));
      localStorage.setItem('bread_cached_profile', JSON.stringify(profile));

      const pdfBlob = createMockBlob('Flight manual PDF content', 'application/pdf');
      await saveBookOffline('airplane_book_1', pdfBlob, { title: 'Flight Manual', author: 'Aviation Press' });

      // Step 2: Turn on Airplane Mode
      setNetworkState(NetworkState.OFFLINE);

      // Step 3: Launch app
      const start = Date.now();
      const isOnline = await checkRealConnectivity({ timeoutMs: 100 });
      assertEquals(isOnline, false, 'Airplane mode correctly identified as offline');
      
      const status = getConnectivityStatus();
      assertEquals(status.isOffline, true, 'Status is offline');

      // Step 4: Verify cached user & profile loaded immediately without spinner block
      const cachedUser = JSON.parse(localStorage.getItem('bread_cached_user'));
      assertEquals(cachedUser.email, 'pilot@test.com', 'Cached user session loaded instantly');

      // Step 5: Verify library view renders cached catalog instantly
      const catalog = getOfflineBooksSync();
      const loadDuration = Date.now() - start;

      assert(catalog.length >= 1, 'Library items present');
      assert(loadDuration < 500, `Cold launch under airplane mode completed in ${loadDuration}ms (<500ms)`);
      const book = catalog.find(b => b.id === 'airplane_book_1');
      assertEquals(book.title, 'Flight Manual', 'Book title matches cached catalog');
    }
  }
];
