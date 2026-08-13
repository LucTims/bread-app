/**
 * BoomRead E2E Test Harness
 * Lightweight test harness simulating browser globals:
 * - window & navigator (with toggleable onLine state)
 * - fetch prober (mocking online, offline, phantom network)
 * - localStorage
 * - IndexedDB / localforage stores: offline_books, book_meta, offline_covers, sync_queue
 * - ServiceWorker cache logic (caches.match, CacheFirst, NetworkFirst)
 * - SpeechSynthesis TTS API
 */

// ─── Storage Implementations ────────────────────────

export class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
  }
  setItem(key, value) {
    this.store.set(String(key), String(value));
  }
  removeItem(key) {
    this.store.delete(String(key));
  }
  clear() {
    this.store.clear();
  }
  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
  get length() {
    return this.store.size;
  }
}

export class MockIndexedDBStore {
  constructor(name) {
    this.name = name;
    this.items = new Map();
  }
  async getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }
  async setItem(key, value) {
    this.items.set(key, value);
    return value;
  }
  async removeItem(key) {
    this.items.delete(key);
  }
  async clear() {
    this.items.clear();
  }
  async keys() {
    return Array.from(this.items.keys());
  }
  async length() {
    return this.items.size;
  }
  async iterate(fn) {
    let index = 0;
    for (const [key, value] of this.items.entries()) {
      const result = fn(value, key, index++);
      if (result !== undefined) return result;
    }
  }
}

// Memory database registry for localforage instances
const _stores = new Map();

export function getLocalforageInstance(storeName) {
  if (!_stores.has(storeName)) {
    _stores.set(storeName, new MockIndexedDBStore(storeName));
  }
  return _stores.get(storeName);
}

export function clearAllLocalforageStores() {
  _stores.clear();
}

// ─── Service Worker Cache Simulator ────────────────────────

export class MockCache {
  constructor(name) {
    this.name = name;
    this.entries = new Map();
  }
  async match(request) {
    const url = typeof request === 'string' ? request : request.url;
    return this.entries.get(url) || null;
  }
  async put(request, response) {
    const url = typeof request === 'string' ? request : request.url;
    this.entries.set(url, response);
  }
  async delete(request) {
    const url = typeof request === 'string' ? request : request.url;
    return this.entries.delete(url);
  }
  async keys() {
    return Array.from(this.entries.keys()).map(url => ({ url }));
  }
}

export class MockCacheStorage {
  constructor() {
    this.caches = new Map();
  }
  async open(cacheName) {
    if (!this.caches.has(cacheName)) {
      this.caches.set(cacheName, new MockCache(cacheName));
    }
    return this.caches.get(cacheName);
  }
  async match(request) {
    for (const cache of this.caches.values()) {
      const res = await cache.match(request);
      if (res) return res;
    }
    return null;
  }
  async has(cacheName) {
    return this.caches.has(cacheName);
  }
  async delete(cacheName) {
    return this.caches.delete(cacheName);
  }
  async keys() {
    return Array.from(this.caches.keys());
  }
}

// ─── SpeechSynthesis TTS Simulator ────────────────────────

export class MockSpeechSynthesisUtterance {
  constructor(text = '') {
    this.text = text;
    this.voice = null;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.onend = null;
    this.onerror = null;
    this.onstart = null;
  }
}

export class MockSpeechSynthesis {
  constructor() {
    this.speaking = false;
    this.paused = false;
    this.pending = false;
    this.queue = [];
    this.voices = [
      { name: 'Henri (French)', lang: 'fr-FR', default: true },
      { name: 'Céleste (French)', lang: 'fr-FR', default: false },
      { name: 'Alex (English)', lang: 'en-US', default: false }
    ];
    this.listeners = new Map();
  }
  getVoices() {
    return this.voices;
  }
  speak(utterance) {
    this.speaking = true;
    this.paused = false;
    this.queue.push(utterance);
    if (utterance.onstart) utterance.onstart();

    // Auto-trigger completion asynchronously for test simplicity unless cancelled
    setTimeout(() => {
      if (this.speaking && this.queue.includes(utterance)) {
        this.speaking = false;
        const idx = this.queue.indexOf(utterance);
        if (idx >= 0) this.queue.splice(idx, 1);
        if (utterance.onend) utterance.onend({ type: 'end' });
      }
    }, 20);
  }
  cancel() {
    this.speaking = false;
    this.paused = false;
    const items = [...this.queue];
    this.queue = [];
    items.forEach(u => {
      if (u.onerror) u.onerror({ type: 'error', error: 'interrupted' });
    });
  }
  pause() {
    if (this.speaking) {
      this.speaking = false;
      this.paused = true;
    }
  }
  resume() {
    if (this.paused) {
      this.paused = false;
      this.speaking = true;
    }
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(listener);
    }
  }
}

// ─── Network State & Reachability Simulator ────────────────────────

export const NetworkState = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  PHANTOM: 'PHANTOM'
};

let _currentNetworkState = NetworkState.ONLINE;
let _phantomTimeoutMs = 3000;
let _routeHandlers = new Map();

export function setNetworkState(state, options = {}) {
  _currentNetworkState = state;
  if (options.phantomTimeoutMs) _phantomTimeoutMs = options.phantomTimeoutMs;

  if (typeof globalThis.navigator !== 'undefined') {
    // navigator.onLine is true for ONLINE and PHANTOM, false for OFFLINE
    const isOnLine = state === NetworkState.ONLINE || state === NetworkState.PHANTOM;
    Object.defineProperty(globalThis.navigator, 'onLine', {
      value: isOnLine,
      configurable: true,
      writable: true
    });
  }

  // Trigger window events
  if (typeof globalThis.window !== 'undefined' && globalThis.window.dispatchEvent) {
    const eventName = (state === NetworkState.ONLINE || state === NetworkState.PHANTOM) ? 'online' : 'offline';
    try {
      globalThis.window.dispatchEvent(new Event(eventName));
    } catch {}
  }
}

export function getNetworkState() {
  return _currentNetworkState;
}

export function registerMockRoute(urlPattern, handler) {
  _routeHandlers.set(urlPattern, handler);
}

export function clearMockRoutes() {
  _routeHandlers.clear();
}

// ─── Mock Fetch Function ────────────────────────

export async function mockFetch(url, options = {}) {
  const urlStr = typeof url === 'string' ? url : url.url;

  // Check custom route handlers first if registered
  for (const [pattern, handler] of _routeHandlers.entries()) {
    if (typeof pattern === 'string' && urlStr.includes(pattern)) {
      return handler(urlStr, options);
    } else if (pattern instanceof RegExp && pattern.test(urlStr)) {
      return handler(urlStr, options);
    }
  }

  // Check network state
  if (_currentNetworkState === NetworkState.OFFLINE) {
    throw new TypeError('Failed to fetch: Network is offline');
  }

  if (_currentNetworkState === NetworkState.PHANTOM) {
    // Simulate timeout or unreachability
    if (options.signal) {
      return new Promise((_, reject) => {
        const onAbort = () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        };
        if (options.signal.aborted) onAbort();
        else options.signal.addEventListener('abort', onAbort);
      });
    }
    // Delay beyond default timeout
    await new Promise(r => setTimeout(r, _phantomTimeoutMs + 500));
    throw new TypeError('Network request failed (phantom connectivity timeout)');
  }

  // Standard ONLINE behavior mock responses
  if (urlStr.includes('/favicon.ico') || urlStr.includes('/ping')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
      text: async () => 'OK',
      blob: async () => createMockBlob('ping', 'text/plain')
    };
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
    blob: async () => createMockBlob('data', 'application/pdf')
  };
}

// ─── Test Environment Setup / Reset ────────────────────────

export class MockFileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
  readAsArrayBuffer(blob) {
    if (blob && blob.arrayBuffer) {
      blob.arrayBuffer().then(buf => {
        this.result = buf;
        if (this.onload) this.onload({ target: this });
      }).catch(err => {
        if (this.onerror) this.onerror(err);
      });
    }
  }
  readAsText(blob) {
    if (blob && blob.text) {
      blob.text().then(txt => {
        this.result = txt;
        if (this.onload) this.onload({ target: this });
      }).catch(err => {
        if (this.onerror) this.onerror(err);
      });
    }
  }
  readAsDataURL(blob) {
    if (blob && blob.text) {
      blob.text().then(txt => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,` + Buffer.from(txt).toString('base64');
        if (this.onload) this.onload({ target: this });
      }).catch(err => {
        if (this.onerror) this.onerror(err);
      });
    }
  }
}

export function setupTestEnvironment() {
  const listeners = new Map();

  const windowMock = {
    location: { href: 'http://localhost:3000/', pathname: '/' },
    addEventListener: (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener: (type, listener) => {
      if (listeners.has(type)) listeners.get(type).delete(listener);
    },
    dispatchEvent: (event) => {
      const type = event.type || event;
      if (listeners.has(type)) {
        for (const cb of listeners.get(type)) {
          try { cb(event); } catch (err) { console.error(err); }
        }
      }
      return true;
    },
    matchMedia: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {}
    }),
    speechSynthesis: new MockSpeechSynthesis(),
    SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
    caches: new MockCacheStorage(),
    localStorage: new MockLocalStorage()
  };

  const navigatorMock = {
    onLine: true,
    standalone: false,
    serviceWorker: {
      ready: Promise.resolve({
        active: { postMessage: () => {} },
        showNotification: async () => {}
      }),
      controller: { postMessage: () => {} }
    }
  };

  class MockFileReader {
    readAsDataURL(blob) {
      setTimeout(async () => {
        try {
          const text = await blob.text();
          const base64 = Buffer.from(text).toString('base64');
          this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
          if (this.onload) this.onload({ target: this });
        } catch (e) {
          if (this.onerror) this.onerror(e);
        }
      }, 0);
    }
    readAsArrayBuffer(blob) {
      setTimeout(async () => {
        try {
          const arrBuf = await blob.arrayBuffer();
          this.result = arrBuf;
          if (this.onload) this.onload({ target: this });
        } catch (e) {
          if (this.onerror) this.onerror(e);
        }
      }, 0);
    }
  }

  globalThis.FileReader = globalThis.FileReader || MockFileReader;
  globalThis.window = windowMock;
  Object.defineProperty(globalThis, 'navigator', {
    value: navigatorMock,
    configurable: true,
    writable: true
  });
  globalThis.localStorage = windowMock.localStorage;
  globalThis.caches = windowMock.caches;
  globalThis.speechSynthesis = windowMock.speechSynthesis;
  globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  globalThis.FileReader = MockFileReader;
  globalThis.fetch = mockFetch;
  globalThis.URL = globalThis.URL || {};
  globalThis.URL.createObjectURL = (blob) => `blob:http://localhost/${Math.random().toString(36).substring(7)}`;
  globalThis.URL.revokeObjectURL = () => {};

  setNetworkState(NetworkState.ONLINE);
}

export function resetTestEnvironment() {
  clearAllLocalforageStores();
  if (globalThis.localStorage && globalThis.localStorage.clear) {
    globalThis.localStorage.clear();
  }
  if (globalThis.speechSynthesis) {
    globalThis.speechSynthesis.cancel();
  }
  clearMockRoutes();
  setNetworkState(NetworkState.ONLINE);
}

// ─── Utility Helpers ────────────────────────

export function createMockBlob(content = 'sample data', type = 'application/pdf') {
  const strContent = typeof content === 'string' ? content : (Buffer.isBuffer(content) ? content.toString('utf8') : String(content));
  const bytes = Buffer.from(strContent);
  return {
    _content: strContent,
    size: bytes.length || 1024,
    type,
    text: async () => strContent,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Assertions ────────────────────────

export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertDeepEquals(actual, expected, message) {
  const aStr = JSON.stringify(actual);
  const eStr = JSON.stringify(expected);
  if (aStr !== eStr) {
    throw new Error(message || `Expected ${eStr}, got ${aStr}`);
  }
}

export async function assertRejects(asyncFn, expectedMsgPattern, message) {
  try {
    await asyncFn();
    throw new Error(message || `Expected promise to reject, but it resolved successfully`);
  } catch (err) {
    if (expectedMsgPattern) {
      const errText = err.message || String(err);
      if (typeof expectedMsgPattern === 'string' && !errText.includes(expectedMsgPattern)) {
        throw new Error(message || `Expected error containing "${expectedMsgPattern}", got "${errText}"`);
      } else if (expectedMsgPattern instanceof RegExp && !expectedMsgPattern.test(errText)) {
        throw new Error(message || `Expected error matching ${expectedMsgPattern}, got "${errText}"`);
      }
    }
  }
}
