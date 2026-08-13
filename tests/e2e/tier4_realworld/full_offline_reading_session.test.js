import {
  setNetworkState,
  NetworkState,
  createMockBlob,
  assert,
  assertEquals
} from '../harness.js';
import {
  saveBookOffline,
  getOfflineBooksSync,
  getOfflineBook,
  saveReadingProgress,
  getReadingProgress,
  enqueueReadingStats,
  getSyncQueue
} from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'RealWorld 1: Full offline reading session (Open offline -> Load catalog -> Read PDF -> Track progress -> Native TTS -> Close session)',
    fn: async () => {
      // Step 1: Pre-condition - book downloaded previously while online
      const bookId = 'rw_session_book';
      const pdfBlob = createMockBlob('Full offline book text for testing real world reading session.', 'application/pdf');
      await saveBookOffline(bookId, pdfBlob, { title: 'Les Misérables', author: 'Victor Hugo' });

      // Step 2: Go offline (simulate subway/airplane)
      setNetworkState(NetworkState.OFFLINE);

      // Step 3: Open app offline - fast index loading (<5ms)
      const catalog = getOfflineBooksSync();
      assert(catalog.length >= 1, 'Library view displays cached books immediately');
      const bookEntry = catalog.find(b => b.id === bookId);
      assertEquals(bookEntry.title, 'Les Misérables', 'Book title in catalog matches');

      // Step 4: Open book in Reader
      const openedBlob = await getOfflineBook(bookId);
      assert(openedBlob !== null, 'Reader loads PDF blob from IndexedDB without network');

      // Step 5: Read pages & track progress
      for (let page = 1; page <= 10; page++) {
        await saveReadingProgress(bookId, page, 500);
      }
      const progress = await getReadingProgress(bookId);
      assertEquals(progress.currentPage, 10, 'Reading progress saved to page 10');

      // Step 6: Trigger native TTS on page text
      const voices = window.speechSynthesis.getVoices();
      const utterance = new window.SpeechSynthesisUtterance('Victor Hugo - Les Misérables page 10');
      utterance.voice = voices[0];
      let ttsSpoke = false;
      utterance.onend = () => { ttsSpoke = true; };
      window.speechSynthesis.speak(utterance);
      await new Promise(r => setTimeout(r, 50));
      assert(ttsSpoke === true, 'Native TTS spoke page text offline');

      // Step 7: Queue reading stats before closing app
      await enqueueReadingStats(bookId, 10, 10, 500);
      const queue = await getSyncQueue();
      assertEquals(queue.length, 1, 'Reading stats stored in sync_queue for background sync');
    }
  }
];
