import {
  setNetworkState,
  NetworkState,
  createMockBlob,
  assert,
  assertEquals
} from '../harness.js';
import {
  saveBookOffline,
  getOfflineBook,
  saveReadingProgress,
  getReadingProgress,
  enqueueReadingStats,
  getSyncQueue
} from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'Combo 1: Offline PDF reading + progress save + background stats queueing',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const bookId = 'combo_book_1';
      const pdfBlob = createMockBlob('PDF CONTENT FOR COMBO TEST 1', 'application/pdf');
      await saveBookOffline(bookId, pdfBlob, { title: 'Combo PDF 1', author: 'Author Combo' });

      // Step 1: Verify book retrieved offline
      const retrievedBlob = await getOfflineBook(bookId);
      assert(retrievedBlob !== null, 'Book PDF blob must be available offline');

      // Step 2: Read pages & save progress
      for (let page = 1; page <= 5; page++) {
        await saveReadingProgress(bookId, page, 40);
      }

      const finalProgress = await getReadingProgress(bookId);
      assertEquals(finalProgress.currentPage, 5, 'Saved reading progress should be page 5');

      // Step 3: Enqueue reading stats for the 5 pages read
      await enqueueReadingStats(bookId, 5, 5, 40);

      // Step 4: Verify sync_queue contains the reading session
      const queue = await getSyncQueue();
      assert(queue.length === 1, 'Sync queue must store offline stats');
      assertEquals(queue[0].bookId, bookId, 'Queued item bookId must match');
      assertEquals(queue[0].pagesRead, 5, 'Queued item pagesRead must be 5');
    }
  }
];
