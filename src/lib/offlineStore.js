import localforage from 'localforage';

// ─── Stores IndexedDB ────────────────────────
const bookStore = localforage.createInstance({
  name: 'bread-app',
  storeName: 'offline_books',
  description: 'Livres PDF téléchargés pour lecture hors-ligne'
});

const metaStore = localforage.createInstance({
  name: 'bread-app',
  storeName: 'book_meta',
  description: 'Métadonnées et progression de lecture'
});

const coverStore = localforage.createInstance({
  name: 'bread-app',
  storeName: 'offline_covers',
  description: 'Couvertures de livres stockées en Blob pour affichage hors-ligne'
});

const syncQueueStore = localforage.createInstance({
  name: 'bread-app',
  storeName: 'sync_queue',
  description: 'File d\'attente pour la synchronisation des statistiques de lecture'
});

// ─── localStorage fast index ────────────────────────
// Stores lightweight book catalog for instant display (<5ms)
// IndexedDB reads happen in background for heavy data (blobs, progress)
const BOOK_INDEX_KEY = 'bread_book_index';      // [{id, title, author, cover_url, sizeBytes, downloadedAt}]
const PROGRESS_INDEX_KEY = 'bread_progress_index'; // {bookId: {currentPage, totalPages, lastReadAt}}

function _readIndex() {
  try {
    const raw = localStorage.getItem(BOOK_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _writeIndex(books) {
  try {
    localStorage.setItem(BOOK_INDEX_KEY, JSON.stringify(books));
  } catch { /* quota exceeded */ }
}

function _readProgressIndex() {
  try {
    const raw = localStorage.getItem(PROGRESS_INDEX_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function _writeProgressIndex(map) {
  try {
    localStorage.setItem(PROGRESS_INDEX_KEY, JSON.stringify(map));
  } catch { /* quota exceeded */ }
}

// ─── Cache mémoire ────────────────────────
let _metaCache = null;       // Map<bookId, metadata>
let _coverUrlCache = {};     // Map<bookId, objectUrl>

/**
 * SYNCHRONOUS — returns book list from localStorage instantly (<5ms)
 * Use this for first render, then hydrate with IndexedDB data in background
 */
export function getOfflineBooksSync() {
  return _readIndex();
}

/**
 * SYNCHRONOUS — returns all reading progress from localStorage instantly
 */
export function getProgressMapSync() {
  return _readProgressIndex();
}

/**
 * SYNCHRONOUS — returns storage usage from the index
 */
export function getStorageUsageSync() {
  const books = _readIndex();
  const totalBytes = books.reduce((sum, b) => sum + (b.sizeBytes || 0), 0);
  return { totalBytes, bookCount: books.length };
}

/**
 * Enregistre un PDF (Blob) dans IndexedDB + met à jour les index rapides
 */
export async function saveBookOffline(bookId, pdfBlob, metadata) {
  await bookStore.setItem(`pdf_${bookId}`, pdfBlob);
  const meta = {
    ...metadata,
    downloadedAt: Date.now(),
    sizeBytes: pdfBlob.size
  };
  await metaStore.setItem(`meta_${bookId}`, meta);

  // Update memory cache
  if (_metaCache) _metaCache.set(bookId, meta);

  // Update localStorage index (add or replace)
  const index = _readIndex();
  const existing = index.findIndex(b => b.id === bookId);
  const entry = { id: bookId, title: metadata.title, author: metadata.author, cover_url: metadata.cover_url, sizeBytes: pdfBlob.size, downloadedAt: meta.downloadedAt };
  if (existing >= 0) index[existing] = entry;
  else index.push(entry);
  _writeIndex(index);
}

/**
 * Enregistre un fichier local (importé par l'utilisateur) dans IndexedDB
 */
export async function saveLocalBook(file, coverBlob = null) {
  const bookId = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  await bookStore.setItem(`pdf_${bookId}`, file);
  
  if (coverBlob) {
    await coverStore.setItem(`cover_${bookId}`, coverBlob);
  }

  const meta = {
    title: file.name.replace(/\.[^/.]+$/, ""), // retire l'extension
    author: 'Fichier local',
    isLocal: true,
    downloadedAt: Date.now(),
    sizeBytes: file.size,
    cover_url: coverBlob ? `local_cover_${bookId}` : null
  };
  await metaStore.setItem(`meta_${bookId}`, meta);

  if (_metaCache) _metaCache.set(bookId, meta);

  const index = _readIndex();
  index.push({ id: bookId, title: meta.title, author: meta.author, cover_url: meta.cover_url, sizeBytes: meta.sizeBytes, downloadedAt: meta.downloadedAt, isLocal: true });
  _writeIndex(index);
  
  return bookId;
}

/**
 * Télécharge et stocke la couverture d'un livre en Blob
 */
export async function saveCoverOffline(bookId, coverUrl) {
  if (!coverUrl) return;
  try {
    const resp = await fetch(coverUrl);
    if (!resp.ok) return;
    const blob = await resp.blob();
    await coverStore.setItem(`cover_${bookId}`, blob);
    // Invalidate old Object URL
    if (_coverUrlCache[bookId]) {
      URL.revokeObjectURL(_coverUrlCache[bookId]);
      delete _coverUrlCache[bookId];
    }
  } catch (err) {
    console.warn(`[offlineStore] Could not cache cover for ${bookId}:`, err);
  }
}

/**
 * Récupère l'Object URL d'une couverture cachée
 */
export async function getCoverObjectUrl(bookId) {
  if (_coverUrlCache[bookId]) return _coverUrlCache[bookId];
  try {
    const blob = await coverStore.getItem(`cover_${bookId}`);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    _coverUrlCache[bookId] = url;
    return url;
  } catch {
    return null;
  }
}

/**
 * Vérifie si un livre est disponible hors-ligne (fast path via memory/localStorage)
 */
export async function isBookOffline(bookId) {
  if (_metaCache) return _metaCache.has(bookId);
  // Fast check via localStorage index
  const index = _readIndex();
  if (index.some(b => b.id === bookId)) return true;
  // Fallback to IDB
  const blob = await bookStore.getItem(`pdf_${bookId}`);
  return blob !== null;
}

/**
 * Récupère le PDF (Blob) depuis IndexedDB
 */
export async function getOfflineBook(bookId) {
  return await bookStore.getItem(`pdf_${bookId}`);
}

/**
 * Récupère les métadonnées d'un livre hors-ligne
 */
export async function getBookMeta(bookId) {
  if (_metaCache && _metaCache.has(bookId)) return _metaCache.get(bookId);
  return await metaStore.getItem(`meta_${bookId}`);
}

/**
 * Supprime un livre du stockage hors-ligne
 */
export async function removeOfflineBook(bookId) {
  await bookStore.removeItem(`pdf_${bookId}`);
  await metaStore.removeItem(`meta_${bookId}`);
  await coverStore.removeItem(`cover_${bookId}`);

  // Clean caches
  if (_metaCache) _metaCache.delete(bookId);
  if (_coverUrlCache[bookId]) {
    URL.revokeObjectURL(_coverUrlCache[bookId]);
    delete _coverUrlCache[bookId];
  }

  // Update localStorage index
  const index = _readIndex().filter(b => b.id !== bookId);
  _writeIndex(index);

  // Update progress index
  const progMap = _readProgressIndex();
  delete progMap[bookId];
  _writeProgressIndex(progMap);
}

/**
 * Sauvegarde la progression de lecture — écrit dans IDB + localStorage index
 */
export async function saveReadingProgress(bookId, page, totalPages) {
  const existing = await metaStore.getItem(`progress_${bookId}`) || {};
  const progress = {
    ...existing,
    currentPage: page,
    totalPages,
    lastReadAt: Date.now()
  };
  await metaStore.setItem(`progress_${bookId}`, progress);

  // Also update the fast localStorage progress index
  const progMap = _readProgressIndex();
  progMap[bookId] = { currentPage: page, totalPages, lastReadAt: progress.lastReadAt };
  _writeProgressIndex(progMap);
}

/**
 * Récupère la progression de lecture
 */
export async function getReadingProgress(bookId) {
  return await metaStore.getItem(`progress_${bookId}`);
}

/**
 * Liste tous les livres disponibles hors-ligne (async, from IDB)
 * Also refreshes the localStorage index to stay in sync
 */
export async function getAllOfflineBooks() {
  const keys = await bookStore.keys();
  const bookIds = keys.filter(k => k.startsWith('pdf_')).map(k => k.replace('pdf_', ''));

  const metaEntries = await Promise.all(
    bookIds.map(async (id) => {
      const meta = await metaStore.getItem(`meta_${id}`);
      return meta ? [id, meta] : null;
    })
  );

  _metaCache = new Map();
  const results = [];
  const indexEntries = [];
  for (const entry of metaEntries) {
    if (entry) {
      const [id, meta] = entry;
      _metaCache.set(id, meta);
      results.push({ id, ...meta });
      indexEntries.push({ id, title: meta.title, author: meta.author, cover_url: meta.cover_url, sizeBytes: meta.sizeBytes, downloadedAt: meta.downloadedAt });
    }
  }

  // Sync the localStorage index with reality
  _writeIndex(indexEntries);

  return results;
}

/**
 * Pré-charge toutes les Object URLs des couvertures
 */
export async function preloadCoverUrls(bookIds) {
  const urls = {};
  await Promise.all(
    bookIds.map(async (id) => {
      const url = await getCoverObjectUrl(id);
      if (url) urls[id] = url;
    })
  );
  return urls;
}

/**
 * Calcule l'espace total utilisé par les livres hors-ligne
 */
export async function getStorageUsage() {
  const books = await getAllOfflineBooks();
  const totalBytes = books.reduce((sum, b) => sum + (b.sizeBytes || 0), 0);
  return { totalBytes, bookCount: books.length };
}

/**
 * Formate la taille en octets en une chaîne lisible
 */
export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

// ─── Sync Queue ────────────────────────

export async function enqueueReadingStats(bookId, pagesRead, currentPage, totalPages) {
  const id = `stats_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  await syncQueueStore.setItem(id, {
    bookId,
    pagesRead,
    currentPage,
    totalPages,
    timestamp: Date.now()
  });
}

export async function getSyncQueue() {
  const keys = await syncQueueStore.keys();
  const items = await Promise.all(keys.map(async k => {
    const data = await syncQueueStore.getItem(k);
    return { id: k, ...data };
  }));
  // Trier par date
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

export async function clearSyncQueueItem(id) {
  await syncQueueStore.removeItem(id);
}
