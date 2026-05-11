import localforage from 'localforage';

// Store configuré pour les livres hors-ligne
const bookStore = localforage.createInstance({
  name: 'bread-app',
  storeName: 'offline_books',
  description: 'Livres PDF téléchargés pour lecture hors-ligne'
});

// Store pour les métadonnées et la progression de lecture
const metaStore = localforage.createInstance({
  name: 'bread-app',
  storeName: 'book_meta',
  description: 'Métadonnées et progression de lecture'
});

/**
 * Enregistre un PDF (Blob) dans IndexedDB
 */
export async function saveBookOffline(bookId, pdfBlob, metadata) {
  await bookStore.setItem(`pdf_${bookId}`, pdfBlob);
  await metaStore.setItem(`meta_${bookId}`, {
    ...metadata,
    downloadedAt: Date.now(),
    sizeBytes: pdfBlob.size
  });
}

/**
 * Vérifie si un livre est disponible hors-ligne
 */
export async function isBookOffline(bookId) {
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
  return await metaStore.getItem(`meta_${bookId}`);
}

/**
 * Supprime un livre du stockage hors-ligne
 */
export async function removeOfflineBook(bookId) {
  await bookStore.removeItem(`pdf_${bookId}`);
  await metaStore.removeItem(`meta_${bookId}`);
  // Garder la progression
}

/**
 * Sauvegarde la progression de lecture (page courante)
 */
export async function saveReadingProgress(bookId, page, totalPages) {
  const existing = await metaStore.getItem(`progress_${bookId}`) || {};
  await metaStore.setItem(`progress_${bookId}`, {
    ...existing,
    currentPage: page,
    totalPages,
    lastReadAt: Date.now()
  });
}

/**
 * Récupère la progression de lecture
 */
export async function getReadingProgress(bookId) {
  return await metaStore.getItem(`progress_${bookId}`);
}

/**
 * Liste tous les livres disponibles hors-ligne avec leurs métadonnées
 */
export async function getAllOfflineBooks() {
  const keys = await bookStore.keys();
  const bookIds = keys.filter(k => k.startsWith('pdf_')).map(k => k.replace('pdf_', ''));
  const results = [];
  for (const id of bookIds) {
    const meta = await metaStore.getItem(`meta_${id}`);
    if (meta) results.push({ id, ...meta });
  }
  return results;
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
