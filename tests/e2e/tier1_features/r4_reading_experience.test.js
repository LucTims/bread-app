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
  getProgressMapSync,
  isBookOffline
} from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'R4-1: Downloaded PDF blob retrieves instantly from IndexedDB',
    fn: async () => {
      const pdfContent = 'PDF-BINARY-DATA-SAMPLE';
      const pdfBlob = createMockBlob(pdfContent, 'application/pdf');

      await saveBookOffline('read_book_1', pdfBlob, { title: 'PDF Book 1', author: 'Author X' });

      const retrievedBlob = await getOfflineBook('read_book_1');
      assert(retrievedBlob !== null, 'PDF blob must be retrieved from IndexedDB');
      const text = await retrievedBlob.text();
      assertEquals(text, pdfContent, 'PDF blob contents should match saved binary');
    }
  },
  {
    name: 'R4-2: Reading progress saved to IndexedDB and fast progress index',
    fn: async () => {
      await saveReadingProgress('read_book_1', 12, 150);

      const progIDB = await getReadingProgress('read_book_1');
      assert(progIDB !== null, 'Progress must be saved in metaStore IDB');
      assertEquals(progIDB.currentPage, 12, 'IndexedDB current page should be 12');
      assertEquals(progIDB.totalPages, 150, 'IndexedDB total pages should be 150');

      const progFast = getProgressMapSync();
      assert(progFast['read_book_1'] !== undefined, 'Progress must exist in fast localStorage index');
      assertEquals(progFast['read_book_1'].currentPage, 12, 'Fast index current page should be 12');
    }
  },
  {
    name: 'R4-3: SpeechSynthesis native TTS initializes and speaks offline',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const voices = window.speechSynthesis.getVoices();
      assert(voices.length > 0, 'TTS voices should be available offline');

      const utter = new window.SpeechSynthesisUtterance('Ceci est un test de lecture vocale hors-ligne.');
      utter.voice = voices[0];

      let completed = false;
      utter.onend = () => { completed = true; };

      window.speechSynthesis.speak(utter);

      // Wait brief moment for harness TTS execution
      await new Promise(r => setTimeout(r, 50));
      assert(completed === true, 'SpeechSynthesis utterance should complete without network');
    }
  },
  {
    name: 'R4-4: Page navigation updates progress state sequentially',
    fn: async () => {
      const bookId = 'nav_book_1';
      
      await saveReadingProgress(bookId, 1, 50);
      let p = await getReadingProgress(bookId);
      assertEquals(p.currentPage, 1, 'Initial page should be 1');

      await saveReadingProgress(bookId, 2, 50);
      p = await getReadingProgress(bookId);
      assertEquals(p.currentPage, 2, 'Navigated page should be 2');

      await saveReadingProgress(bookId, 3, 50);
      p = await getReadingProgress(bookId);
      assertEquals(p.currentPage, 3, 'Navigated page should be 3');
    }
  },
  {
    name: 'R4-5: Un-downloaded book offline check fails gracefully',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      const exists = await isBookOffline('non_existent_book_99');
      assertEquals(exists, false, 'Un-downloaded book should return false for offline check');
    }
  }
];
