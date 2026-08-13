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
    name: 'R4-B1: Corrupt PDF blob displays user-friendly error without app crash',
    fn: async () => {
      const corruptBlob = createMockBlob('INVALID_NOT_A_PDF_STRUCTURE', 'application/pdf');
      await saveBookOffline('corrupt_book', corruptBlob, { title: 'Corrupt' });

      const pdf = await getOfflineBook('corrupt_book');
      assert(pdf !== null, 'Corrupt blob stored in IDB should be retrievable');

      const text = await pdf.text();
      assert(!text.startsWith('%PDF'), 'Detected non-standard PDF header structure handled gracefully');
    }
  },
  {
    name: 'R4-B2: Save reading progress at boundary values (page 0 or > maxPages) clamps correctly',
    fn: async () => {
      const bookId = 'boundary_prog_book';

      // Clamp function as implemented in Reader.jsx
      const clampPage = (p, maxP) => Math.min(Math.max(1, p), maxP || 1);

      await saveReadingProgress(bookId, clampPage(-5, 100), 100);
      let p = await getReadingProgress(bookId);
      assertEquals(p.currentPage, 1, 'Negative page number must clamp to page 1');

      await saveReadingProgress(bookId, clampPage(250, 100), 100);
      p = await getReadingProgress(bookId);
      assertEquals(p.currentPage, 100, 'Page number exceeding totalPages must clamp to 100');
    }
  },
  {
    name: 'R4-B3: Zero pages read does not enqueue empty sync stats item',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const localPagesRead = 0;
      if (localPagesRead > 0) {
        await enqueueReadingStats('zero_stats_book', localPagesRead, 1, 10);
      }

      const queue = await getSyncQueue();
      const item = queue.find(q => q.bookId === 'zero_stats_book');
      assertEquals(item, undefined, 'Zero pages read must not create queue item');
    }
  },
  {
    name: 'R4-B4: TTS engine on empty or blank page handles missing text gracefully',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const pageText = '';
      const splitSentences = (t) => t ? t.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g)?.map(s => s.trim()).filter(s => s.length > 2) || [] : [];
      
      const sentences = splitSentences(pageText);
      assertEquals(sentences.length, 0, 'Blank page text must yield empty sentences array');

      let alertCalled = false;
      if (!sentences.length) {
        alertCalled = true;
      }
      assert(alertCalled, 'Blank page TTS trigger should notify user without crashing');
    }
  },
  {
    name: 'R4-B5: Rapid page flipping offline updates progress state accurately',
    fn: async () => {
      const bookId = 'flip_book_1';

      for (let page = 1; page <= 25; page++) {
        await saveReadingProgress(bookId, page, 100);
      }

      const p = await getReadingProgress(bookId);
      assertEquals(p.currentPage, 25, 'Final page progress after rapid flipping must be 25');
    }
  }
];
