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
    { id: 'dark', label: 'Sombre', bg: '#1a1a1a', text: '#e0e0e0', icon: 'dark_mode' },
    { id: 'sepia', label: 'Sépia', bg: '#f4ecd8', text: '#5b4636', icon: 'coffee' },
    { id: 'light', label: 'Clair', bg: '#f8f6f0', text: '#333', icon: 'light_mode' },
    { id: 'cream', label: 'Crème', bg: '#FFF8E7', text: '#3d3d3d', icon: 'wb_sunny' },
    { id: 'night', label: 'Nuit', bg: '#0d1117', text: '#c9d1d9', icon: 'bedtime' },
];

const SCROLL_MODES = [
    { id: 'paginated', label: 'Page par page', icon: 'auto_stories', desc: 'Tourner les pages' },
    { id: 'vertical', label: 'Défilement vertical', icon: 'swap_vert', desc: 'Haut → Bas' },
    { id: 'horizontal', label: 'Défilement horizontal', icon: 'swap_horiz', desc: 'Gauche → Droite' },
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
    const [scrollMode, setScrollMode] = useState('paginated');
    const [theme, setTheme] = useState('dark');
    const [showToolbar, setShowToolbar] = useState(true);
    
    // Panels
    const [showThemePanel, setShowThemePanel] = useState(false);
    const [showModePanel, setShowModePanel] = useState(false);
    
    // Touch / Pinch zoom
    const pinchRef = useRef({ startDist: 0, startScale: 1 });
    const swipeRef = useRef({ startX: 0, startY: 0, startTime: 0 });
    const canvasRef = useRef(null);
    const pdfUrlRef = useRef(null);

    // Cleanup Object URL on unmount
    useEffect(() => {
        return () => {
            if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        };
    }, []);

    // Convert blob to fast Object URL
    const setBlobAsPdf = (blob) => {
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        const url = URL.createObjectURL(blob);
        pdfUrlRef.current = url;
        setPdfFile(url);
    };

    // ─── DATA LOADING ────────────────────────
    const loadBook = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const offlinePdfBlob = await getOfflineBook(bookId);
            const offlineMeta = await getBookMeta(bookId);

            if (offlinePdfBlob) {
                setBlobAsPdf(offlinePdfBlob);
                setBookMeta(offlineMeta);
            } else {
                if (!navigator.onLine) {
                    throw new Error("Ce livre n'est pas téléchargé et vous n'avez pas de connexion Internet.");
                }

                const { data: access } = await supabase
                    .from('user_book_access').select('id')
                    .eq('user_id', user.id).eq('book_id', bookId).single();

                let hasAccess = !!access;
                if (!hasAccess) {
                    const { data: orders } = await supabase.from('orders')
                        .select('id, order_items(book_id)')
                        .eq('user_id', user.id).eq('status', 'paid');
                    hasAccess = orders?.some(o => o.order_items?.some(oi => oi.book_id === bookId));
                }
                if (!hasAccess) throw new Error("Accès non autorisé. Vous n'avez pas acheté ce livre.");

                const { data: book } = await supabase.from('books').select('*').eq('id', bookId).single();
                if (!book) throw new Error('Livre introuvable.');
                setBookMeta({ title: book.title });

                const filePath = book.file_url || `pdfs/${bookId}.pdf`;
                let blob = null;
                const { data: directBlob, error: dlErr } = await supabase.storage.from('books').download(filePath);
                if (!dlErr && directBlob) { blob = directBlob; }
                else {
                    const { data: sd } = await supabase.storage.from('books').createSignedUrl(filePath, 3600);
                    if (sd?.signedUrl) { const r = await fetch(sd.signedUrl); if (r.ok) blob = await r.blob(); }
                }
                if (!blob) throw new Error("Le fichier PDF n'est pas disponible.");

                await saveBookOffline(bookId, blob, { title: book.title, author: book.author, cover_url: book.cover_url });
                setBlobAsPdf(blob);
            }

            const progress = await getReadingProgress(bookId);
            if (progress?.currentPage) setPageNumber(progress.currentPage);
        } catch (err) {
            console.error(err);
            setError(err.message || "Erreur de chargement.");
        } finally {
            setLoading(false);
        }
    }, [bookId]);

    useEffect(() => {
        if (!navigator.onLine) {
            (async () => {
                setLoading(true);
                try {
                    const blob = await getOfflineBook(bookId);
                    const meta = await getBookMeta(bookId);
                    if (blob) {
                        setBlobAsPdf(blob);
                        setBookMeta(meta);
                        const p = await getReadingProgress(bookId);
                        if (p?.currentPage) setPageNumber(p.currentPage);
                    } else {
                        setError("Ce livre n'est pas téléchargé. Connectez-vous à Internet.");
                    }
                } catch { setError("Erreur de chargement hors-ligne."); }
                finally { setLoading(false); }
            })();
            return;
        }
        if (authLoading) return;
        if (!user) { navigate('/login'); return; }
        loadBook();
    }, [user, authLoading, navigate, loadBook, bookId]);

    // ─── PINCH TO ZOOM ────────────────────────
    const getDistance = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;

        const onTouchStart = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                pinchRef.current.startDist = getDistance(e.touches[0], e.touches[1]);
                pinchRef.current.startScale = scale;
            } else if (e.touches.length === 1) {
                swipeRef.current.startX = e.touches[0].clientX;
                swipeRef.current.startY = e.touches[0].clientY;
                swipeRef.current.startTime = Date.now();
            }
        };

        const onTouchMove = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = getDistance(e.touches[0], e.touches[1]);
                const ratio = dist / pinchRef.current.startDist;
                const newScale = Math.min(4.0, Math.max(0.5, pinchRef.current.startScale * ratio));
                setScale(newScale);
            }
        };

        const onTouchEnd = (e) => {
            if (e.changedTouches.length === 1 && scrollMode === 'paginated') {
                const dx = e.changedTouches[0].clientX - swipeRef.current.startX;
                const dy = e.changedTouches[0].clientY - swipeRef.current.startY;
                const dt = Date.now() - swipeRef.current.startTime;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);
                
                // Horizontal swipe for page turn
                if (dt < 400 && absDx > 60 && absDx > absDy * 1.5) {
                    if (dx < 0) changePage(1);   // swipe left = next
                    else changePage(-1);          // swipe right = prev
                }
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [scale, scrollMode, pageNumber, numPages]);

    // ─── HANDLERS ────────────────────────
    const onDocumentLoadSuccess = ({ numPages: n }) => setNumPages(n);
    
    const changePage = async (offset) => {
        const newPage = Math.min(Math.max(1, pageNumber + offset), numPages || 1);
        setPageNumber(newPage);
        if (numPages) await saveReadingProgress(bookId, newPage, numPages);
    };

    const toggleToolbar = () => {
        if (showThemePanel || showModePanel) {
            setShowThemePanel(false);
            setShowModePanel(false);
            return;
        }
        setShowToolbar(p => !p);
    };

    const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];
    const pct = numPages ? Math.round((pageNumber / numPages) * 100) : 0;

    // ─── LOADING / ERROR ────────────────────────
    if (authLoading || loading) return (
        <div className="reader-container">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--color-primary)', marginBottom: 20 }}></div>
                <p>Chargement...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="reader-container" style={{ alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <div className="empty-state">
                <span className="material-symbols-outlined empty-state-icon" style={{ color: 'var(--color-accent)' }}>error</span>
                <h2>Impossible de lire le livre</h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>{error}</p>
                <button className="btn btn-primary" onClick={() => navigate('/')}>Retour</button>
            </div>
        </div>
    );

    // ─── RENDER ────────────────────────
    return (
        <div className={`reader-container theme-${theme}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: currentTheme.bg, transition: 'background 0.4s ease' }}>
            
            {/* ── Top Toolbar ── */}
            <div className={`reader-toolbar ${!showToolbar ? 'hidden' : ''}`} style={{ flexShrink: 0, zIndex: 100 }}>
                <button onClick={() => navigate('/')}><span className="material-symbols-outlined">arrow_back</span></button>
                <div className="reader-toolbar-title line-clamp-1">{bookMeta?.title || 'Lecture'}</div>
                <button onClick={(e) => { e.stopPropagation(); }} style={{ visibility: 'hidden' }}>
                    <span className="material-symbols-outlined">more_vert</span>
                </button>
            </div>

            {/* ── Page Progress Bar ── */}
            {showToolbar && numPages && (
                <div style={{ height: 3, background: 'rgba(128,128,128,0.2)', flexShrink: 0, zIndex: 100 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', transition: 'width 0.3s ease', borderRadius: '0 2px 2px 0' }} />
                </div>
            )}

            {/* ── PDF Canvas Area ── */}
            <div 
                ref={canvasRef}
                className="reader-canvas-area hide-scrollbar" 
                style={{ 
                    flex: 1, 
                    overflowY: scrollMode === 'horizontal' ? 'hidden' : 'auto',
                    overflowX: scrollMode === 'horizontal' ? 'auto' : 'hidden',
                    display: 'flex', 
                    flexDirection: scrollMode === 'horizontal' ? 'row' : 'column',
                    alignItems: 'center',
                    padding: scrollMode === 'paginated' ? '16px 0' : '8px 0',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    touchAction: 'pan-x pan-y',
                }}
                onContextMenu={(e) => e.preventDefault()}
                onClick={toggleToolbar}
            >
                {pdfFile && (
                    <Document
                        file={pdfFile}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="spinner" style={{ margin: 'auto' }} />}
                        error={<p style={{ color: currentTheme.text }}>Erreur PDF.</p>}
                    >
                        {scrollMode === 'paginated' ? (
                            <Page 
                                pageNumber={pageNumber} 
                                scale={scale} 
                                renderAnnotationLayer={false} 
                                renderTextLayer={false}
                                className="pdf-page-shadow"
                            />
                        ) : (
                            Array.from(new Array(numPages || 0), (_, index) => (
                                <div key={`page_${index + 1}`} style={{ 
                                    marginBottom: scrollMode === 'vertical' ? 8 : 0,
                                    marginRight: scrollMode === 'horizontal' ? 8 : 0,
                                    flexShrink: 0
                                }}>
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

            {/* ── Theme Panel (slides up) ── */}
            {showThemePanel && (
                <div style={{
                    position: 'absolute', bottom: 80, left: 0, right: 0, zIndex: 200,
                    background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
                    borderRadius: '20px 20px 0 0', padding: '24px 20px 32px',
                    animation: 'slideUp 0.3s ease'
                }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>Couleur de fond</h3>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                        {THEMES.map(t => (
                            <button key={t.id} onClick={() => { setTheme(t.id); setShowThemePanel(false); }}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                    padding: '12px 16px', borderRadius: 16,
                                    background: theme === t.id ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)',
                                    border: theme === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                                    transition: 'all 0.2s ease', cursor: 'pointer', minWidth: 56
                                }}
                            >
                                <div style={{
                                    width: 44, height: 44, borderRadius: '50%', background: t.bg,
                                    border: '2px solid rgba(255,255,255,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: theme === t.id ? '0 0 12px rgba(255,215,0,0.3)' : 'none'
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: t.text }}>{t.icon}</span>
                                </div>
                                <span style={{ fontSize: 11, color: theme === t.id ? 'var(--color-primary)' : 'rgba(255,255,255,0.6)', fontWeight: theme === t.id ? 700 : 500 }}>{t.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Scroll Mode Panel ── */}
            {showModePanel && (
                <div style={{
                    position: 'absolute', bottom: 80, left: 0, right: 0, zIndex: 200,
                    background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
                    borderRadius: '20px 20px 0 0', padding: '24px 20px 32px',
                    animation: 'slideUp 0.3s ease'
                }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>Mode de lecture</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {SCROLL_MODES.map(m => (
                            <button key={m.id} onClick={() => { setScrollMode(m.id); setShowModePanel(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                                    borderRadius: 14,
                                    background: scrollMode === m.id ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.05)',
                                    border: scrollMode === m.id ? '1.5px solid var(--color-primary)' : '1.5px solid transparent',
                                    transition: 'all 0.2s ease', cursor: 'pointer', width: '100%', textAlign: 'left'
                                }}
                            >
                                <div style={{
                                    width: 42, height: 42, borderRadius: 12, background: scrollMode === m.id ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 22, color: scrollMode === m.id ? '#000' : 'rgba(255,255,255,0.6)' }}>{m.icon}</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: scrollMode === m.id ? 'var(--color-primary)' : '#fff' }}>{m.label}</div>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{m.desc}</div>
                                </div>
                                {scrollMode === m.id && <span className="material-symbols-outlined" style={{ marginLeft: 'auto', color: 'var(--color-primary)', fontSize: 20 }}>check_circle</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Bottom Action Bar ── */}
            <div className={`reader-bottom-bar ${!showToolbar ? 'hidden' : ''}`} style={{ 
                flexShrink: 0, zIndex: 100, justifyContent: 'space-around', padding: '6px 8px 10px',
                borderTop: '1px solid rgba(255,255,255,0.08)'
            }}>
                {/* Page Navigation */}
                <button onClick={(e) => { e.stopPropagation(); changePage(-1); }} disabled={pageNumber <= 1 || scrollMode !== 'paginated'}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: scrollMode !== 'paginated' ? 0.3 : 1 }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>navigate_before</span>
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Précédent</span>
                </button>

                {/* Page Turner / Indicator */}
                <button onClick={(e) => { e.stopPropagation(); changePage(1); }} disabled={pageNumber >= numPages || scrollMode !== 'paginated'}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative' }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>navigate_next</span>
                    <span style={{ fontSize: 9, fontWeight: 600 }}>{pageNumber}/{numPages || '-'}</span>
                </button>

                {/* Scroll Mode */}
                <button onClick={(e) => { e.stopPropagation(); setShowThemePanel(false); setShowModePanel(p => !p); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: showModePanel ? 'var(--color-primary)' : 'inherit' }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                        {SCROLL_MODES.find(m => m.id === scrollMode)?.icon || 'auto_stories'}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Mode</span>
                </button>

                {/* Theme / Color */}
                <button onClick={(e) => { e.stopPropagation(); setShowModePanel(false); setShowThemePanel(p => !p); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: showThemePanel ? 'var(--color-primary)' : 'inherit' }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>palette</span>
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Couleur</span>
                </button>
            </div>
        </div>
    );
}
