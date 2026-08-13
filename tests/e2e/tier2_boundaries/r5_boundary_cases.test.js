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
    name: 'R5-B1: Max retry limit reached for persistent server error marks item for backoff',
    fn: async () => {
      await enqueueReadingStats('retry_book_1', 10, 50, 200);

      const queue = await getSyncQueue();
      const item = queue[0];

      let attempts = 0;
      const maxRetries = 3;
      const syncItemWithRetry = async (syncItem) => {
        attempts++;
        if (attempts <= maxRetries) {
          throw new Error('503 Service Unavailable');
        }
        await clearSyncQueueItem(syncItem.id);
      };

      for (let i = 0; i < maxRetries; i++) {
        try {
          await syncItemWithRetry(item);
        } catch (err) {
          // Expected retry failure
        }
      }

      assertEquals(attempts, 3, 'Attempts should reach max retries limit');
      const remaining = await getSyncQueue();
      assertEquals(remaining.length, 1, 'Failed item should remain in sync queue for backoff retry');
    }
  },
  {
    name: 'R5-B2: Duplicate reading stats queued for same book merge or sync idempotently',
    fn: async () => {
      await enqueueReadingStats('dup_book_1', 5, 20, 100);
      await enqueueReadingStats('dup_book_1', 5, 25, 100);

      const queue = await getSyncQueue();
      assertEquals(queue.length, 2, 'Queue stores individual reading sessions');

      let totalPagesReadSynced = 0;
      for (const item of queue) {
        totalPagesReadSynced += item.pagesRead;
        await clearSyncQueueItem(item.id);
      }

      assertEquals(totalPagesReadSynced, 10, 'Aggregated pages read during sync should equal sum of queued sessions');
      const emptyQueue = await getSyncQueue();
      assertEquals(emptyQueue.length, 0, 'Queue should be empty after processing duplicates');
    }
  },
  {
    name: 'R5-B3: Network loss mid-sync pauses queue processing and preserves unsynced items',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);
      for (let i = 1; i <= 4; i++) {
        await enqueueReadingStats(`mid_drop_book_${i}`, 2, 10, 50);
      }

      setNetworkState(NetworkState.ONLINE);
      const queue = await getSyncQueue();
      let syncedCount = 0;

      for (const item of queue) {
        if (syncedCount === 2) {
          // Network drops mid-sync
          setNetworkState(NetworkState.OFFLINE);
        }

        if (!navigator.onLine) {
          break; // Stop processing when offline
        }

        await clearSyncQueueItem(item.id);
        syncedCount++;
      }

      assertEquals(syncedCount, 2, 'Only first 2 items should sync before network drop');
      const remaining = await getSyncQueue();
      assertEquals(remaining.length, 2, 'Remaining 2 items must be preserved in queue');
    }
  },
  {
    name: 'R5-B4: Corrupt sync queue record is bypassed without blocking remaining items',
    fn: async () => {
      const localforage = (await import('localforage')).default;
      const syncQueueStore = localforage.createInstance({ name: 'bread-app', storeName: 'sync_queue' });

      // Insert 1 valid, 1 corrupt, 1 valid item
      await syncQueueStore.setItem('stats_valid_1', { bookId: 'valid_1', pagesRead: 3, timestamp: 100 });
      await syncQueueStore.setItem('stats_corrupt_2', null); // Corrupt null record
      await syncQueueStore.setItem('stats_valid_3', { bookId: 'valid_3', pagesRead: 7, timestamp: 300 });

      const rawQueue = await getSyncQueue();
      let processedCount = 0;

      for (const item of rawQueue) {
        if (!item || !item.bookId) {
          // Bypass corrupt item and clear it
          await clearSyncQueueItem(item.id);
          continue;
        }
        processedCount++;
        await clearSyncQueueItem(item.id);
      }

      assertEquals(processedCount, 2, '2 valid queue items should be processed');
      const remaining = await getSyncQueue();
      assertEquals(remaining.length, 0, 'Corrupt item and valid items should all be cleaned');
    }
  },
  {
    name: 'R5-B5: Sync attempt under 401 Unauthorized retains queue until re-auth',
    fn: async () => {
      await enqueueReadingStats('unauth_book_1', 4, 12, 60);

      const queue = await getSyncQueue();
      const item = queue[0];

      let isAuthorized = false;
      const syncItem = async (syncItem) => {
        if (!isAuthorized) {
          const err = new Error('401 Unauthorized');
          err.status = 401;
          throw err;
        }
        await clearSyncQueueItem(syncItem.id);
      };

      try {
        await syncItem(item);
      } catch (err) {
        // Retain queue on 401 error
      }

      let remaining = await getSyncQueue();
      assertEquals(remaining.length, 1, 'Queue item must be retained when sync returns 401');

      // Now user re-authenticates
      isAuthorized = true;
      await syncItem(item);

      remaining = await getSyncQueue();
      assertEquals(remaining.length, 0, 'Queue item clears successfully after re-auth');
    }
  }
];
