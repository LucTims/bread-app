import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getOfflineBook, getBookMeta, saveReadingProgress, getReadingProgress, saveBookOffline } from '../lib/offlineStore';
import { supabase } from '../lib/supabase';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF Worker for Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const THEMES = [
    { id: 'dark', label: 'Sombre', bg: '#1a1a1a', swatch: '#1a1a1a' },
    { id: 'sepia', label: 'Sépia', bg: '#f4ecd8', swatch: '#f4ecd8' },
    { id: 'light', label: 'Clair', bg: '#f8f6f0', swatch: '#f8f6f0' },
];

export default function Reader() {
    const { bookId } = useParams();
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [pdfFile, setPdfFile] = useState(null);
    const [bookMeta, setBookMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // PDF State
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [viewMode, setViewMode] = useState('paginated'); // 'paginated' | 'continuous'
    const [theme, setTheme] = useState('dark');
    const [showToolbar, setShowToolbar] = useState(true);

    const loadBook = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // 1. Essayer de charger depuis IndexedDB (Hors-ligne)
            const offlinePdfBlob = await getOfflineBook(bookId);
            const offlineMeta = await getBookMeta(bookId);

            if (offlinePdfBlob) {
                setPdfFile(offlinePdfBlob);
                setBookMeta(offlineMeta);
            } else {
                // 2. Fallback: Vérifier les droits, télécharger et sauvegarder en hors-ligne
                if (!navigator.onLine) {
                    throw new Error("Ce livre n'est pas téléchargé et vous n'avez pas de connexion Internet.");
                }

                // Vérification de l'accès (orders ou user_book_access)
                const { data: access } = await supabase
                    .from('user_book_access')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('book_id', bookId)
                    .single();

                let hasAccess = !!access;

                if (!hasAccess) {
                    const { data: orders } = await supabase
                        .from('orders')
                        .select('id, order_items(book_id)')
                        .eq('user_id', user.id)
                        .eq('status', 'paid');
                    
                    hasAccess = orders?.some(o => o.order_items?.some(oi => oi.book_id === bookId));
                }

                if (!hasAccess) {
                    throw new Error("Accès non autorisé. Vous n'avez pas acheté ce livre.");
                }

                // Récupérer les infos du livre
                const { data: book } = await supabase.from('books').select('*').eq('id', bookId).single();
                if (!book) throw new Error('Livre introuvable.');

                setBookMeta({ title: book.title });

                // Télécharger le PDF complet depuis Supabase Storage
                const filePath = book.file_url || `pdfs/${bookId}.pdf`;
                const { data: blob, error: downloadErr } = await supabase.storage.from('books').download(filePath);
                
                if (downloadErr || !blob) {
                    throw new Error("Impossible de télécharger le fichier PDF.");
                }

                // Sauvegarder automatiquement en local (IndexedDB)
                await saveBookOffline(bookId, blob, { 
                    title: book.title, 
                    author: book.author, 
                    cover_url: book.cover_url 
                });

                // Utiliser le blob téléchargé
                setPdfFile(blob);
            }

            // Restore reading progress
            const progress = await getReadingProgress(bookId);
            if (progress && progress.currentPage) {
                setPageNumber(progress.currentPage);
            }

        } catch (err) {
            console.error(err);
            setError(err.message || "Erreur de chargement.");
        } finally {
            setLoading(false);
        }
    }, [bookId]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { navigate('/login'); return; }
        loadBook();
    }, [user, authLoading, navigate, loadBook]);

    const toggleToolbar = () => setShowToolbar(p => !p);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
    };

    const changePage = async (offset) => {
        const newPage = Math.min(Math.max(1, pageNumber + offset), numPages || 1);
        setPageNumber(newPage);
        if (numPages) {
            await saveReadingProgress(bookId, newPage, numPages);
        }
    };

    const handleZoomIn = () => setScale(s => Math.min(3.0, s + 0.25));
    const handleZoomOut = () => setScale(s => Math.max(0.5, s - 0.25));

    if (authLoading || loading) return (
        <div className="reader-container">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--color-primary)', marginBottom: 20 }}></div>
                <p>Chargement du lecteur sécurisé...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="reader-container" style={{ alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <div className="empty-state">
                <span className="material-symbols-outlined empty-state-icon" style={{ color: 'var(--color-accent)' }}>error</span>
                <h2>Impossible de lire le livre</h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>{error}</p>
                <button className="btn btn-primary" onClick={() => navigate('/')}>Retour à la bibliothèque</button>
            </div>
        </div>
    );

    return (
        <div className={`reader-container theme-${theme}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            {/* Toolbar Haut */}
            <div className={`reader-toolbar ${!showToolbar ? 'hidden' : ''}`} style={{ flexShrink: 0, zIndex: 100 }}>
                <button onClick={() => navigate('/')}><span className="material-symbols-outlined">arrow_back</span></button>
                <div className="reader-toolbar-title line-clamp-1">{bookMeta?.title || 'Lecture'}</div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <button onClick={() => setViewMode(v => v === 'paginated' ? 'continuous' : 'paginated')} title="Changer le mode de défilement">
                        <span className="material-symbols-outlined">
                            {viewMode === 'paginated' ? 'view_stream' : 'auto_stories'}
                        </span>
                    </button>
                    <button onClick={() => {
                        const nextIndex = (THEMES.findIndex(t => t.id === theme) + 1) % THEMES.length;
                        setTheme(THEMES[nextIndex].id);
                    }} title="Changer de thème">
                        <span className="material-symbols-outlined">palette</span>
                    </button>
                </div>
            </div>

            {/* Zone de lecture avec DRM (blocage clic droit et sélection) */}
            <div 
                className="reader-canvas-area hide-scrollbar" 
                style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    overflowX: 'auto',
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '20px 0',
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                }}
                onContextMenu={(e) => e.preventDefault()}
                onClick={toggleToolbar}
            >
                {pdfFile && (
                    <Document
                        file={pdfFile}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="spinner" style={{ margin: 'auto' }} />}
                        error={<p style={{color: '#fff'}}>Erreur de chargement du PDF.</p>}
                    >
                        {viewMode === 'paginated' ? (
                            <Page 
                                pageNumber={pageNumber} 
                                scale={scale} 
                                renderAnnotationLayer={false} 
                                renderTextLayer={false}
                                className="pdf-page-shadow"
                            />
                        ) : (
                            Array.from(new Array(numPages || 0), (el, index) => (
                                <div key={`page_${index + 1}`} style={{ marginBottom: 20 }}>
                                    <Page 
                                        pageNumber={index + 1} 
                                        scale={scale} 
                                        renderAnnotationLayer={false} 
                                        renderTextLayer={false}
                                        className="pdf-page-shadow"
                                    />
                                </div>
                            ))
                        )}
                    </Document>
                )}
            </div>

            {/* Toolbar Bas */}
            <div className={`reader-bottom-bar ${!showToolbar ? 'hidden' : ''}`} style={{ flexShrink: 0, zIndex: 100 }}>
                {viewMode === 'paginated' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginRight: 'auto' }}>
                        <button onClick={(e) => { e.stopPropagation(); changePage(-1); }} disabled={pageNumber <= 1}>
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{pageNumber} / {numPages || '-'}</span>
                        <button onClick={(e) => { e.stopPropagation(); changePage(1); }} disabled={pageNumber >= numPages}>
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: viewMode === 'paginated' ? 0 : 'auto' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}><span className="material-symbols-outlined">remove</span></button>
                    <span style={{ fontSize: 14, fontWeight: 700, width: 40, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
                    <button onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}><span className="material-symbols-outlined">add</span></button>
                </div>
            </div>
        </div>
    );
}
