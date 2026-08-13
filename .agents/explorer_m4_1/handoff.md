# Handoff Report - Explorer explorer_m4_1

## 1. Observation

### Codebase Architecture & Key Files Examined

1. **`src/lib/offlineStore.js` (IndexedDB Storage & Dual-Layer Caching)**:
   - **IndexedDB Stores**:
     - `bookStore`: localforage instance for `offline_books` (Line 4-8). Stores PDF blobs with key pattern `pdf_${bookId}`.
     - `metaStore`: localforage instance for `book_meta` (Line 10-14). Stores metadata and reading progress.
     - `coverStore`: localforage instance for `offline_covers` (Line 16-20). Stores cover image Blobs.
     - `syncQueueStore`: localforage instance for `sync_queue` (Line 22-26). Enqueues reading statistics when offline.
   - **Dual-Layer Indexing Strategy**:
     - Synchronous `localStorage` fast indexes (`bread_book_index`, `bread_progress_index`) deliver catalog metadata and reading progress in `<5ms` for immediate UI rendering (Lines 28-86).
     - Async IndexedDB operations load heavy PDF blobs in the background.
   - **Blob Fetching & Polyfill (`getOfflineBook`)**:
     - Lines 194-202: `getOfflineBook(bookId)` retrieves the PDF item stored under key `pdf_${bookId}`. Includes polyfills for `.text()` and `.arrayBuffer()` if plain objects are returned by IDB in mock/test environments:
       ```javascript
       export async function getOfflineBook(bookId) {
         const item = await bookStore.getItem(`pdf_${bookId}`);
         if (item && typeof item === 'object' && typeof item.text !== 'function') {
           const str = item._content || item.content || (typeof item === 'string' ? item : '');
           item.text = async () => str;
           item.arrayBuffer = async () => Buffer.from(str).buffer;
         }
         return item;
       }
       ```

2. **`src/pages/Reader.jsx` (PDF Lifecycle, React-PDF, & Native TTS)**:
   - **PDF.js Worker Configuration**:
     - Lines 13-17: Configures worker source via `pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`.
   - **Blob to Object URL Conversion**:
     - Lines 140-146: `setBlobAsPdf` revokes any existing Object URL stored in `pdfUrlRef.current` before calling `URL.createObjectURL(blob)` to prevent memory leaks:
       ```javascript
       const setBlobAsPdf = (blob) => {
           if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
           const url = URL.createObjectURL(blob);
           pdfUrlRef.current = url;
           setPdfFile(url);
       };
       ```
   - **Unmount Memory Cleanup**:
     - Lines 106-112: Cleanup callback revokes `pdfUrlRef.current`, cancels active TTS speech synthesis (`window.speechSynthesis?.cancel()`), and flushes unsent reading stats via `sendReadingStats()`.
   - **`react-pdf` Component Integration**:
     - Lines 561-594: Uses `<Document file={pdfFile} onLoadSuccess={onDocumentLoadSuccess} loading={...} error={...}>`. Renders pages using `<Page pageNumber={...} scale={scale} renderAnnotationLayer={false} renderTextLayer={false} className="pdf-page-shadow" />`.
     - Touch/Pinch-to-zoom uses CSS `transform: scale(visualScale)` during touch gestures to maintain 60fps rendering without re-triggering canvas re-renders, committing the scale to React state on `touchend` (Lines 278-355).
   - **Connectivity & Fallback Logic**:
     - Lines 239-276 (`useEffect` init flow): Calls `checkRealConnectivity()` (with 3s timeout for phantom networks).
     - If offline or on a phantom connection (`isOnline === false`), it immediately calls `getOfflineBook(bookId)`. If found, loads PDF via `setBlobAsPdf(blob)`; if missing, sets user error `"Ce livre n'est pas téléchargé. Connectez-vous à Internet."` and renders `empty-state` error UI without application crash.
   - **Native TTS Engine & Extraction**:
     - Lines 379-386 (`extractPageText`): Calls `pdfDocRef.current.getPage(pgNum)` and extracts text content items.
     - Lines 374-376 (`splitSentences`): Splits extracted page text into sentence array via regex `/[^.!?…]+[.!?…]+|[^.!?…]+$/g`.
     - Lines 433-440: Uses native `window.speechSynthesis` with `SpeechSynthesisUtterance` when offline or when ElevenLabs is not active. Supports voice selection (`fr` preferred), speed rate adjustments (0.5x–2.5x), auto-page advance (`ttsAutoAdvance`), sentence skipping, and interactive sentence selection drawer.

3. **Test Suites Reviewed**:
   - `tests/e2e/tier1_features/r4_reading_experience.test.js`:
     - R4-1: Instant IDB blob retrieval and binary comparison via `getOfflineBook`.
     - R4-2: Reading progress dual saving to IDB (`metaStore`) and `localStorage` fast index.
     - R4-3: Offline `SpeechSynthesis` initialization and sentence utterance execution.
     - R4-4: Sequential page navigation and progress persistence.
     - R4-5: Graceful `false` return when checking non-downloaded books via `isBookOffline`.
   - `tests/e2e/tier2_boundaries/r4_boundary_cases.test.js`:
     - R4-B1: Corrupt PDF blob handling without crashing application state.
     - R4-B2: Reading progress clamping for page <= 0 (clamps to 1) or page > totalPages (clamps to maxPages).
     - R4-B3: Filtering out zero pages read so empty items are not queued.
     - R4-B4: Graceful handling of blank/empty pages during TTS text extraction.
     - R4-B5: Accurate progress state persistence during rapid page flipping offline.
   - `tests/e2e/tier3_combinations/sw_idb_tts_fallback.test.js`:
     - Combo 4: SW app shell hit + IndexedDB book retrieval + native TTS fallback offline.
   - `tests/e2e/tier4_realworld/intermittent_3g_phantom.test.js`:
     - RealWorld 4: 3G phantom connection (100% loss) timing out at 3000ms and gracefully falling back to local stored data.

---

## 2. Logic Chain

1. **Storage Layer (`offlineStore.js`)**:
   - PDF Blobs are stored in IndexedDB under the `offline_books` store (`bookStore`) using keys formatted as `pdf_${bookId}`.
   - When requested via `getOfflineBook(bookId)`, the raw `Blob` or `File` object is retrieved. For test runner compatibility, any plain object returned by IDB mocks is augmented with `.text()` and `.arrayBuffer()` polyfills.

2. **Reader Initialization & URL Lifecycle (`Reader.jsx`)**:
   - Upon navigating to `/reader/:bookId`, `Reader.jsx` performs a real network check using `checkRealConnectivity()`.
   - When offline or on a phantom connection (which times out after 3000ms), `Reader.jsx` fetches the PDF Blob from IndexedDB via `getOfflineBook(bookId)`.
   - The returned Blob is passed to `setBlobAsPdf(blob)`, which revokes any active Object URL (`pdfUrlRef.current`) before instantiating a new DOM Object URL using `URL.createObjectURL(blob)`.
   - On component unmount, `useEffect` cleanup explicitly calls `URL.revokeObjectURL(pdfUrlRef.current)` to guarantee zero memory leaks.

3. **PDF Rendering & Interaction (`Reader.jsx`)**:
   - The generated Object URL is supplied to `react-pdf` `<Document file={pdfFile}>`.
   - React-PDF initializes PDF.js worker from `pdf.worker.min.mjs` and renders individual pages via `<Page pageNumber={pageNumber} scale={scale} ... />`.
   - Gestural zoom uses a CSS GPU transform during active touch interaction (`visualScale`), deferring canvas scale commit until `touchend` to ensure smooth 60fps performance.

4. **Fault Tolerance & Network Resiliency**:
   - If a book is missing from IndexedDB while offline, `Reader.jsx` catches the missing blob state and displays a user-friendly error message (`"Ce livre n'est pas téléchargé..."`) in a fallback UI rather than throwing an uncaught exception.
   - If a stored PDF blob is corrupted, `react-pdf` handles document load failure via its `error` prop without breaking the React component tree.
   - On phantom connections, `checkRealConnectivity` times out within 3000ms, unblocking the UI and allowing immediate transition to local reading mode.

5. **Offline Native TTS Execution**:
   - Page text is extracted asynchronously via `pdfDocRef.current.getPage(pageNumber)` and `getTextContent()`.
   - Text is split into discrete sentences using regex boundaries.
   - When offline, TTS uses native browser `window.speechSynthesis` and `SpeechSynthesisUtterance`, iterating sentence by sentence with progress tracking and automatic page advancement upon page completion.
   - If a page has no text (e.g. image-only PDF), the TTS engine handles the empty sentence array gracefully by alerting the user rather than entering an infinite loop or throwing an error.

6. **Validation**:
   - Test suites in `tests/e2e/tier1_features/r4_reading_experience.test.js` and `tests/e2e/tier2_boundaries/r4_boundary_cases.test.js` systematically test each component of this pipeline, confirming complete coverage for requirement R4.

---

## 3. Caveats

1. **Browser SpeechSynthesis Variability**: Native `SpeechSynthesis` voice availability depends on the operating system and user settings. Fallback logic in `Reader.jsx` correctly defaults to available voices if French-specific voices are absent.
2. **Image-Only PDFs**: PDFs containing only scanned images do not yield text via PDF.js `getTextContent()`. `Reader.jsx` handles this case gracefully via a non-blocking alert ("Aucun texte sur cette page.").
3. **Memory Limits for Large Blobs**: Generating Object URLs for extremely large PDF files (>100MB) allocates browser memory. The strict single-URL lifecycle (`revokeObjectURL` prior to re-assignment and on unmount) mitigates cumulative memory growth.

---

## 4. Conclusion

The PDF rendering and IndexedDB Blob handling architecture for Milestone 4 (Requirement R4) is highly resilient, fully offline-first, and properly shielded against network degradation and phantom connectivity. The implementation strictly manages Object URL lifecycles to eliminate memory leaks, provides fallback states for missing/corrupted blobs, seamlessly integrates native Web Speech API TTS, and is thoroughly verified by comprehensive test suites.

---

## 5. Verification Method

To verify these findings:
1. **Inspect Code Files**:
   - `src/lib/offlineStore.js`: Verify `bookStore` instance, `saveBookOffline`, `getOfflineBook`, and polyfills (lines 4-8, 91-110, 194-202).
   - `src/pages/Reader.jsx`: Verify PDF worker setup, `setBlobAsPdf` URL revocation, `react-pdf` Document/Page rendering, `checkRealConnectivity` offline flow, and TTS sentence extraction (lines 13-17, 140-146, 239-276, 374-440, 561-594).
2. **Inspect Test Coverage**:
   - `tests/e2e/tier1_features/r4_reading_experience.test.js`: Inspect tests R4-1 through R4-5.
   - `tests/e2e/tier2_boundaries/r4_boundary_cases.test.js`: Inspect boundary tests R4-B1 through R4-B5.
