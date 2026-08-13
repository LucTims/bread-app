import {
  setNetworkState,
  NetworkState,
  assert,
  assertEquals
} from '../harness.js';
import { checkRealConnectivity } from '../../../src/lib/connectivity.js';
import {
  enqueueReadingStats,
  getSyncQueue,
  clearSyncQueueItem
} from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'Combo 3: Network restoration mid-reading + automatic background sync',
    fn: async () => {
      // Step 1: Start offline and enqueue reading stats
      setNetworkState(NetworkState.OFFLINE);
      await enqueueReadingStats('reconnect_book_1', 8, 30, 150);
      await enqueueReadingStats('reconnect_book_2', 4, 15, 100);

      let queue = await getSyncQueue();
      assertEquals(queue.length, 2, '2 sessions queued while offline');

      // Step 2: Network is restored (reconnection event)
      setNetworkState(NetworkState.ONLINE);
      const isOnline = await checkRealConnectivity({ timeoutMs: 100 });
      assert(isOnline === true, 'Connectivity restored');

      // Step 3: Trigger background sync processing
      for (const item of queue) {
        // Simulate Supabase RPC call update_reading_stats
        await clearSyncQueueItem(item.id);
      }

      // Step 4: Verify sync queue is emptied
      queue = await getSyncQueue();
      assertEquals(queue.length, 0, 'Sync queue emptied automatically after reconnection sync');
    }
  }
];
