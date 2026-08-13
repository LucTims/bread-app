# Handoff Report: Native Browser TTS (SpeechSynthesis) Integration Analysis (Milestone 4 / R4)

## 1. Observation

### 1.1 Source Code Architecture & Key Files
- **`src/pages/Reader.jsx`**: Main reading interface managing PDF rendering, text extraction, TTS state management, speech synthesis execution, and transport UI controls.
  - **Text Extraction** (lines 379-386): `extractPageText(pgNum)` calls `pdfDocRef.current.getPage(pgNum)` and extracts items using `content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim()`.
  - **Sentence Splitting** (lines 374-377): `splitSentences(text)` splits extracted page text via regex `/[^.!?…]+[.!?…]+|[^.!?…]+$/g` to enable sentence-level tracking, highlighting, jumping, and auto-advancing.
  - **Voice Loading** (lines 115-125): `useEffect` subscribes to `voiceschanged` event on `window.speechSynthesis` and loads system voices into state `ttsVoices`, prioritizing French voices (`lang.startsWith('fr')`).
  - **Audio Engine Selection** (lines 416-440): `speakSentence(sentences, idx)` checks state `useElevenLabs`. If `true`, calls cloud API `generateElevenLabsSpeech()`. If `false`, instantiates `new SpeechSynthesisUtterance(sentences[idx])` and executes `window.speechSynthesis.speak(utter)`.
- **`src/lib/elevenLabs.js`**: Helper module for cloud TTS generation using ElevenLabs REST API (`https://api.elevenlabs.io/v1/...`).
- **`src/lib/connectivity.js`**: Provides `checkRealConnectivity()` to test true HTTP reachability and detect offline/phantom network states.
- **`tests/e2e/harness.js`**: Implements `MockSpeechSynthesis` (lines 152-210) and `MockSpeechSynthesisUtterance` (lines 139-150) for testing browser native TTS without external dependencies.

### 1.2 Offline & Phantom Network Fallback Mechanics
- **Native Browser TTS (`window.speechSynthesis`)**:
  - Entirely local to client JavaScript and browser OS audio subsystems.
  - Works with zero network requests when `navigator.onLine` is false or during phantom network conditions.
- **Cloud ElevenLabs TTS**:
  - `generateElevenLabsSpeech` (lines 36-63 of `elevenLabs.js`) makes HTTP POST requests to ElevenLabs API.
  - In `Reader.jsx` lines 416-432, when `useElevenLabs` is `true`:
    ```javascript
    const audioUrl = await generateElevenLabsSpeech(sentences[idx], elevenVoiceId);
    if (audioUrl) { ... } else { ttsStop(); }
    ```
  - **Observed Gap**: If the device is offline or on a phantom network, `generateElevenLabsSpeech()` returns `null` on fetch failure. `speakSentence()` handles this by calling `ttsStop()` (lines 430-431), stopping audio playback completely rather than seamlessly falling back to `window.speechSynthesis`. Furthermore, `checkRealConnectivity()` is not consulted before attempting ElevenLabs API calls.

### 1.3 Speech Synthesis Lifecycle
- **Initialization**: Voices loaded asynchronously via `window.speechSynthesis.getVoices()` and `voiceschanged` event listener.
- **Play (`ttsSpeak`)**: Cancels any ongoing synthesis (`window.speechSynthesis.cancel()`), extracts text, splits sentences, sets `ttsActiveRef.current = true`, and starts `speakSentence(sentences, 0)`. Resumes if paused (`window.speechSynthesis.resume()`).
- **Sentence Progression & Auto-Advance**:
  - `utter.onend` triggers `speakSentence(sentences, idx + 1)`.
  - When all sentences on a page complete (`idx >= sentences.length`), if `ttsAutoAdvance` is enabled and `pageNumber < numPages`, the reader advances `pageNumber`, saves reading progress to IndexedDB (`saveReadingProgress`), extracts next page text, and continues playback automatically after 400ms.
- **Pause (`ttsPause`)**: Executes `window.speechSynthesis.pause()`.
- **Stop (`ttsStop`)**: Executes `window.speechSynthesis.cancel()` and resets active/playing state flags.
- **Playback Speed Rate**: Bound to `utter.rate = ttsRate` (range `0.5x` to `2.5x`).
- **Error Handling**: `utter.onerror = () => ttsStop()`, and `window.speechSynthesis.cancel()` runs on component unmount (`useEffect` cleanup on line 109).

### 1.4 E2E Test Suite Coverage
1. **`tests/e2e/tier1_features/r4_reading_experience.test.js`**:
   - `R4-3: SpeechSynthesis native TTS initializes and speaks offline`: Sets `NetworkState.OFFLINE`, verifies `window.speechSynthesis.getVoices()`, dispatches `SpeechSynthesisUtterance`, and confirms `onend` completes offline without network access.
2. **`tests/e2e/tier2_boundaries/r4_boundary_cases.test.js`**:
   - `R4-B4: TTS engine on empty or blank page handles missing text gracefully`: Tests empty page text `''`, verifies sentence array is empty, and confirms user notification alert occurs without app crash.
3. **`tests/e2e/tier3_combinations/sw_idb_tts_fallback.test.js`**:
   - `Combo 4: Service Worker shell hit + IndexedDB book retrieval + native TTS fallback`: Tests full offline stack (Service Worker app shell + IndexedDB PDF blob retrieval + native browser `SpeechSynthesis` TTS).
4. **`tests/e2e/tier4_realworld/full_offline_reading_session.test.js`**:
   - `RealWorld 1: Full offline reading session`: End-to-end simulation of opening offline reader, retrieving document, saving progress, and triggering native TTS speech offline.

---

## 2. Logic Chain

1. **Requirement R4 Core Mandate**: Offline reading experience must be robust, responsive, and functional without active network connectivity.
2. **Local vs Cloud Audio Synthesis**:
   - `window.speechSynthesis` operates purely on client device resources (OS speech engines). Therefore, when network connectivity drops or phantom network exists, Native TTS remains 100% operational.
   - Cloud TTS (ElevenLabs) depends on remote API endpoints (`api.elevenlabs.io`). When offline or on phantom network (`checkRealConnectivity()` = false), network requests fail.
3. **Synthesis Lifecycle Continuity**:
   - Sentence-level granularity in `Reader.jsx` allows precise tracking (`ttsSentenceIdx`), UI feedback, skip previous/next controls, and page auto-advance.
   - However, when `useElevenLabs` is active during network loss, `generateElevenLabsSpeech` fails, causing `speakSentence` to call `ttsStop()`.
4. **Conclusion from Observations**:
   - The Native Browser TTS implementation in `Reader.jsx` is clean, modular, and thoroughly tested for native playback offline.
   - To make cloud-to-native fallback bulletproof, `Reader.jsx` should check `checkRealConnectivity()` before calling ElevenLabs or automatically fallback to native `SpeechSynthesis` if ElevenLabs API fails.

---

## 3. Caveats

- **System Voice Availability**: Available TTS voices in `window.speechSynthesis.getVoices()` depend on the underlying host system (Windows/macOS/Android/iOS). Browser defaults fall back safely if French specific voices are not installed.
- **Scanned PDF Text Layers**: Text extraction via `pdfjs` requires PDFs to have selectable text layers. Image-only PDFs yield empty text, which `Reader.jsx` handles gracefully via `if (!sentences.length) alert('Aucun texte sur cette page.')`.
- **E2E Test Execution**: In Node.js E2E test environments, browser Web Speech API is simulated via `MockSpeechSynthesis` in `tests/e2e/harness.js`.

---

## 4. Conclusion & Recommendations

### Assessment
The Native Browser TTS (`SpeechSynthesis`) integration in `Reader.jsx` fulfills Requirement R4 for offline reading experience. It supports full audio lifecycle (play, pause, stop, speed adjustment, sentence navigation, auto-page advance, empty text boundary handling) and is covered by dedicated E2E unit and integration tests across Tier 1, Tier 2, Tier 3, and Tier 4 suites.

### Recommendations for Implementers
1. **Automatic Offline Fallback for Cloud TTS**:
   Modify `speakSentence` in `Reader.jsx` (lines 416-440) so that if `useElevenLabs` is enabled but `checkRealConnectivity()` returns `false` OR `generateElevenLabsSpeech` returns `null`, the application automatically falls back to native `SpeechSynthesisUtterance` instead of calling `ttsStop()`.
2. **User Notification on Engine Switch**:
   When falling back from ElevenLabs to Native SpeechSynthesis offline, display a subtle toast/banner notifying the user: *"Mode hors-ligne: passage à la voix système native"*.

---

## 5. Verification Method

### Test Suite Execution
Run the E2E test suite to verify Native TTS offline behavior and boundary cases:
```bash
node tests/e2e/runner.js
```

### Direct Code Inspection Points
1. **SpeechSynthesis Engine**: `src/pages/Reader.jsx` lines 373-480.
2. **Offline Network Detector**: `src/lib/connectivity.js` lines 62-131 (`checkRealConnectivity`).
3. **ElevenLabs Helper**: `src/lib/elevenLabs.js` lines 36-63 (`generateElevenLabsSpeech`).
4. **E2E Test Cases**:
   - `tests/e2e/tier1_features/r4_reading_experience.test.js` (Test R4-3)
   - `tests/e2e/tier2_boundaries/r4_boundary_cases.test.js` (Test R4-B4)
   - `tests/e2e/tier3_combinations/sw_idb_tts_fallback.test.js` (Test Combo 4)
