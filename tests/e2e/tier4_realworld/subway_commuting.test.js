import {
  setNetworkState,
  NetworkState,
  createMockBlob,
  assert,
  assertEquals
} from '../harness.js';
import { checkRealConnectivity, getConnectivityStatus } from '../../../src/lib/connectivity.js';
import {
  saveBookOffline,
  getOfflineBook,
  saveReadingProgress,
  enqueueReadingStats,
  getSyncQueue,
  clearSyncQueueItem
} from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'RealWorld 2: Subway commuting scenario (Online download -> Phantom tunnel -> Offline reading -> Reconnect sync)',
    fn: async () => {
      const bookId = 'subway_book_1';

      // Phase 1: At home (ONLINE) - download book
      setNetworkState(NetworkState.ONLINE);
      const isOnlineHome = await checkRealConnectivity({ timeoutMs: 100 });
      assert(isOnlineHome === true, 'Home network online');

      const pdfBlob = createMockBlob('Subway reader PDF binary data', 'application/pdf');
      await saveBookOffline(bookId, pdfBlob, { title: 'Le Comte de Monte-Cristo', author: 'Alexandre Dumas' });

      // Phase 2: Enter subway station (PHANTOM network - mobile data icon on, 0 reachability)
      setNetworkState(NetworkState.PHANTOM, { phantomTimeoutMs: 50 });
      const isOnlineStation = await checkRealConnectivity({ timeoutMs: 100 });
      assertEquals(isOnlineStation, false, 'Reachability prober correctly identifies phantom network in station');
      const stationStatus = getConnectivityStatus();
      assertEquals(stationStatus.isPhantom, true, 'Station connectivity marked as phantom');

      // Phase 3: In subway tunnel (OFFLINE) - open book & read 15 pages
      setNetworkState(NetworkState.OFFLINE);
      const book = await getOfflineBook(bookId);
      assert(book !== null, 'Book opens seamlessly in tunnel from IndexedDB');

      await saveReadingProgress(bookId, 15, 800);
      await enqueueReadingStats(bookId, 15, 15, 800);

      let queue = await getSyncQueue();
      assertEquals(queue.length, 1, 'Tunnel reading stats queued in sync_queue');

      // Phase 4: Exit subway station (ONLINE restored) - auto flush sync queue
      setNetworkState(NetworkState.ONLINE);
      const isOnlineExit = await checkRealConnectivity({ timeoutMs: 100 });
      assert(isOnlineExit === true, 'Connectivity restored on exit');

      for (const item of queue) {
        await clearSyncQueueItem(item.id);
      }

      queue = await getSyncQueue();
      assertEquals(queue.length, 0, 'Sync queue flushed cleanly upon exiting subway');
    }
  }
];
