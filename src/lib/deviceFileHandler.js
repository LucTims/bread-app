import { saveLocalBook } from './offlineStore';
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export const extractPdfCover = async (file) => {
    return new Promise(async (resolve) => {
        try {
            const url = URL.createObjectURL(file);
            const pdf = await pdfjs.getDocument(url).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context, viewport }).promise;
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
        } catch (e) {
            console.error("Erreur extraction cover:", e);
            resolve(null);
        }
    });
};

export async function importFilesList(fileList) {
    if (!fileList || fileList.length === 0) return [];
    const createdIds = [];
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            const coverUrl = await extractPdfCover(file);
            const id = await saveLocalBook(file, coverUrl);
            createdIds.push(id);
        } else if (file.name.toLowerCase().endsWith('.epub')) {
            const id = await saveLocalBook(file, null);
            createdIds.push(id);
        }
    }
    return createdIds;
}

let _intentListenerRegistered = false;

/**
 * Enregistre l'écouteur d'intention Android (quand l'utilisateur ouvre un PDF depuis WhatsApp ou l'explorateur)
 * @param {(bookId: string) => void} onFileOpened Callback appelé quand un document est prêt à être lu
 */
export function initDeviceFileHandler(onFileOpened) {
  if (typeof window === 'undefined' || _intentListenerRegistered) return;
  _intentListenerRegistered = true;

  // 1. Écouter les URLs d'ouverture natives via Capacitor
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try {
      window.Capacitor.Plugins.App.addListener('appUrlOpen', async (data) => {
        if (!data || !data.url) return;
        console.log('[DeviceFileHandler] Document ouvert depuis le système:', data.url);
        try {
          // Si l'URL est accessible directement
          const response = await fetch(data.url);
          const blob = await response.blob();
          const fileName = decodeURIComponent(data.url.split('/').pop() || 'Document.pdf');
          const file = new File([blob], fileName, { type: blob.type || 'application/pdf' });
          const bookId = await saveLocalBook(file);
          if (onFileOpened) onFileOpened(bookId);
        } catch (err) {
          console.error('[DeviceFileHandler] Erreur ouverture fichier intent:', err);
        }
      });
    } catch (e) {
      console.warn('[DeviceFileHandler] Impossible d\'enregistrer le listener App:', e);
    }
  }

  // 2. Gestion du Drag & Drop rapide sur toute la fenêtre
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => 
        f.type === 'application/pdf' || 
        f.name.toLowerCase().endsWith('.pdf') || 
        f.name.toLowerCase().endsWith('.epub')
      );
      if (files.length > 0) {
        for (const f of files) {
          const bookId = await saveLocalBook(f);
          if (onFileOpened) onFileOpened(bookId);
        }
      }
    }
  });
}
