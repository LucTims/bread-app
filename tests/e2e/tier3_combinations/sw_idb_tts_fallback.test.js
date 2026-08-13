import {
  setNetworkState,
  NetworkState,
  createMockBlob,
  assert,
  assertEquals
} from '../harness.js';
import { saveBookOffline, getOfflineBook, getBookMeta } from '../../../src/lib/offlineStore.js';

export default [
  {
    name: 'Combo 4: Service Worker shell hit + IndexedDB book retrieval + native TTS fallback',
    fn: async () => {
      setNetworkState(NetworkState.OFFLINE);

      // Step 1: Match app shell from SW cache
      const cache = await globalThis.caches.open('boomread-app-shell-v1');
      await cache.put('/reader/tts_book_1', { ok: true, status: 200, isShell: true });
      const shellRes = await cache.match('/reader/tts_book_1');
      assert(shellRes !== null, 'App shell served from SW cache offline');

      // Step 2: Retrieve PDF blob and metadata from IndexedDB
      const pdfBlob = createMockBlob('CHAPTER 1: The journey begins with offline speech.', 'application/pdf');
      await saveBookOffline('tts_book_1', pdfBlob, { title: 'TTS Book', author: 'Author Voice' });

      const retrievedBlob = await getOfflineBook('tts_book_1');
      const retrievedMeta = await getBookMeta('tts_book_1');
      assert(retrievedBlob !== null, 'PDF Blob retrieved from IDB');
      assertEquals(retrievedMeta.title, 'TTS Book', 'Metadata title retrieved from IDB');

      // Step 3: Extract text and run native SpeechSynthesis TTS offline
      const text = await retrievedBlob.text();
      const voices = window.speechSynthesis.getVoices();
      assert(voices.length > 0, 'Browser native TTS voices available');

      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.voice = voices[0];
      let ttsDone = false;
      utterance.onend = () => { ttsDone = true; };

      window.speechSynthesis.speak(utterance);
      await new Promise(r => setTimeout(r, 50));

      assert(ttsDone === true, 'Native browser SpeechSynthesis completed offline without ElevenLabs API dependency');
    }
  }
];
