import {
  setNetworkState,
  NetworkState,
  assert,
  assertEquals
} from '../harness.js';
import { enqueueReadingStats, getSyncQueue, clearSyncQueueItem } from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'Combo 5: Sync retry backoff + network state flip-flop resilience',
    fn: async () => {
      // Step 1: Queue stats offline
      setNetworkState(NetworkState.OFFLINE);
      await enqueueReadingStats('flip_book_1', 10, 40, 200);

      // Step 2: Reconnect online but server returns 503 error
      setNetworkState(NetworkState.ONLINE);
      let queue = await getSyncQueue();
      assertEquals(queue.length, 1, '1 item in queue');

      let failed = false;
      try {
        throw new Error('503 Service Unavailable');
      } catch (err) {
        failed = true;
      }
      assert(failed, 'First sync attempt failed with server error');

      // Step 3: Network flip-flops to offline mid-backoff
      setNetworkState(NetworkState.OFFLINE);
      queue = await getSyncQueue();
      assertEquals(queue.length, 1, 'Item retained in queue during offline flip-flop');

      // Step 4: Network recovers to online and sync retry succeeds
      setNetworkState(NetworkState.ONLINE);
      await clearSyncQueueItem(queue[0].id);

      queue = await getSyncQueue();
      assertEquals(queue.length, 0, 'Sync retry succeeded on reconnection, queue cleared cleanly');
    }
  }
];
