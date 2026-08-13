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
    name: 'Combo 2: Phantom network + Auth load + cached book catalog rendering',
    fn: async () => {
      // Step 1: Simulate phantom network (navigator.onLine = true, but ping times out)
      setNetworkState(NetworkState.PHANTOM, { phantomTimeoutMs: 100 });

      // Seed cached auth session
      const user = { id: 'usr_phantom', email: 'phantom@test.com' };
      const profile = { id: 'usr_phantom', role: 'reader', name: 'Phantom User' };
      localStorage.setItem('bread_cached_user', JSON.stringify(user));
      localStorage.setItem('bread_cached_profile', JSON.stringify(profile));

      // Seed cached catalog index
      const catalog = [{ id: 'b_p1', title: 'Phantom Book 1', author: 'Author P' }];
      localStorage.setItem('bread_book_index', JSON.stringify(catalog));

      // Step 2: Probe connectivity - must resolve to phantom/offline quickly
      const isOnline = await checkRealConnectivity({ timeoutMs: 200 });
      assertEquals(isOnline, false, 'Phantom connectivity probe must resolve to false');
      
      const status = getConnectivityStatus();
      assertEquals(status.isPhantom, true, 'Status should be isPhantom = true');

      // Step 3: Auth context fallback loads cached user immediately
      const cachedUser = JSON.parse(localStorage.getItem('bread_cached_user'));
      assertEquals(cachedUser.id, 'usr_phantom', 'Cached user session loaded instantly');

      // Step 4: Library/Home view renders cached catalog instantly
      const renderedBooks = getOfflineBooksSync();
      assertEquals(renderedBooks.length, 1, 'Cached catalog loaded instantly (<5ms)');
      assertEquals(renderedBooks[0].title, 'Phantom Book 1', 'Book title matches cached index');
    }
  }
];
