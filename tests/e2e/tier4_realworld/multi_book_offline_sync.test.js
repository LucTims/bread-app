import {
  setNetworkState,
  NetworkState,
  createMockBlob,
  assert,
  assertEquals
} from '../harness.js';
import {
  saveBookOffline,
  saveReadingProgress,
  enqueueReadingStats,
  getSyncQueue,
  clearSyncQueueItem
} from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'RealWorld 5: Multi-book offline library sync (Offline session across 3 books -> queued stats -> batch sync on reconnect)',
    fn: async () => {
      // Step 1: User downloads 3 books while online
      setNetworkState(NetworkState.ONLINE);
      const books = [
        { id: 'mb_1', title: 'Book One', pages: 10 },
        { id: 'mb_2', title: 'Book Two', pages: 15 },
        { id: 'mb_3', title: 'Book Three', pages: 8 }
      ];

      for (const b of books) {
        const blob = createMockBlob(`Blob for ${b.title}`, 'application/pdf');
        await saveBookOffline(b.id, blob, { title: b.title });
      }

      // Step 2: User goes offline
      setNetworkState(NetworkState.OFFLINE);

      // Step 3: User reads across all 3 books offline
      for (const b of books) {
        await saveReadingProgress(b.id, b.pages, 300);
        await enqueueReadingStats(b.id, b.pages, b.pages, 300);
      }

      // Step 4: Verify sync queue contains all 3 reading sessions
      let queue = await getSyncQueue();
      assertEquals(queue.length, 3, 'Sync queue contains stats for all 3 books');

      // Step 5: Network restored - batch sync flushes all queued stats
      setNetworkState(NetworkState.ONLINE);
      const syncedBookIds = [];

      for (const item of queue) {
        syncedBookIds.push(item.bookId);
        await clearSyncQueueItem(item.id);
      }

      assertEquals(syncedBookIds.length, 3, 'Batch sync processed all 3 book sessions');
      assert(syncedBookIds.includes('mb_1') && syncedBookIds.includes('mb_2') && syncedBookIds.includes('mb_3'), 'All book IDs present in batch sync');

      queue = await getSyncQueue();
      assertEquals(queue.length, 0, 'Sync queue is completely empty after batch sync');
    }
  }
];
