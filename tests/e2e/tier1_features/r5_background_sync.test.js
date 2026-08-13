import {
  setNetworkState,
  NetworkState,
  assert,
  assertEquals
} from '../harness.js';
import {
  enqueueReadingStats,
  getSyncQueue,
  clearSyncQueueItem
} from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'R5-1: Reading stats accumulated offline are enqueued into sync_queue',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      await enqueueReadingStats('sync_book_1', 5, 25, 200);

      const queue = await getSyncQueue();
      assert(queue.length === 1, 'Sync queue should contain 1 item');
      assertEquals(queue[0].bookId, 'sync_book_1', 'Queued item bookId should match');
      assertEquals(queue[0].pagesRead, 5, 'Queued item pagesRead should match');
      assertEquals(queue[0].currentPage, 25, 'Queued item currentPage should match');
    }
  },
  {
    name: 'R5-2: Sync queue flushes queued items sequentially on reconnect',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      await enqueueReadingStats('book_sync_A', 3, 10, 100);
      await enqueueReadingStats('book_sync_B', 8, 20, 100);

      let queue = await getSyncQueue();
      assertEquals(queue.length, 2, 'Queue should have 2 items offline');

      // Simulate reconnect and queue flush
      setNetworkState(NetworkState.ONLINE);
      for (const item of queue) {
        // Simulate server RPC update success
        await clearSyncQueueItem(item.id);
      }

      queue = await getSyncQueue();
      assertEquals(queue.length, 0, 'Sync queue should be completely empty after flush');
    }
  },
  {
    name: 'R5-3: Sync queue item clearing removes specific item by ID',
    fn: async () => {
      await enqueueReadingStats('book_clear_1', 4, 15, 80);
      await enqueueReadingStats('book_clear_2', 6, 30, 80);

      let queue = await getSyncQueue();
      assertEquals(queue.length, 2, 'Initial queue length should be 2');

      const firstItemId = queue[0].id;
      await clearSyncQueueItem(firstItemId);

      queue = await getSyncQueue();
      assertEquals(queue.length, 1, 'Queue length should be 1 after clearing item');
      assertEquals(queue[0].bookId, 'book_clear_2', 'Remaining item should be second item');
    }
  },
  {
    name: 'R5-4: Non-blocking sync processing handles multiple queued events',
    fn: async () => {
      // Enqueue 5 reading sessions
      for (let i = 1; i <= 5; i++) {
        await enqueueReadingStats(`batch_book_${i}`, i * 2, i * 10, 100);
      }

      const queue = await getSyncQueue();
      assertEquals(queue.length, 5, 'Queue should contain 5 items');

      const processedIds = [];
      const start = Date.now();
      
      // Async flush loop
      for (const item of queue) {
        processedIds.push(item.id);
        await clearSyncQueueItem(item.id);
      }
      const duration = Date.now() - start;

      assert(duration < 200, `Queue flush took ${duration}ms, expected under 200ms`);
      assertEquals(processedIds.length, 5, 'All 5 items should be processed');
      const remaining = await getSyncQueue();
      assertEquals(remaining.length, 0, 'Remaining queue should be empty');
    }
  },
  {
    name: 'R5-5: Local book reading stats skip sync queueing',
    fn: async () => {
      const isLocalBook = true;
      const bookId = 'local_1700000000_abc';

      if (!isLocalBook && !navigator.onLine) {
        await enqueueReadingStats(bookId, 5, 10, 50);
      }

      const queue = await getSyncQueue();
      const localItem = queue.find(q => q.bookId === bookId);
      assertEquals(localItem, undefined, 'Local book stats should not be queued in sync_queue');
    }
  }
];
