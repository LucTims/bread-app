import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getOfflineBook, getBookMeta, saveReadingProgress, getReadingProgress, saveBookOffline, saveCoverOffline, enqueueReadingStats } from '../lib/offlineStore';
import { supabase } from '../lib/supabase';
import { Document, Page, pdfjs } from 'react-pdf';
import BookChat from '../components/BookChat';
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
    const [showAudioPanel, setShowAudioPanel] = useState(false);
    const [showChat, setShowChat] = useState(false);

    // TTS Audio — sentence-level tracking
    const [ttsPlaying, setTtsPlaying] = useState(false);
    const [ttsPaused, setTtsPaused] = useState(false);
    const [ttsRate, setTtsRate] = useState(1.0);
    const [ttsVoices, setTtsVoices] = useState([]);
    const [ttsVoiceIdx, setTtsVoiceIdx] = useState(0);
    const [ttsLoading, setTtsLoading] = useState(false);
    const [ttsSentences, setTtsSentences] = useState([]);
    const [ttsSentenceIdx, setTtsSentenceIdx] = useState(0);
    const [ttsAutoAdvance, setTtsAutoAdvance] = useState(true);
    const pdfDocRef = useRef(null);
    const ttsActiveRef = useRef(false);
    
    // Touch / Pinch zoom
    const pinchRef = useRef({ startDist: 0, startScale: 1 });
    const swipeRef = useRef({ startX: 0, startY: 0, startTime: 0 });
    const canvasRef = useRef(null);
    const pdfUrlRef = useRef(null);
    
    // Reading Stats Tracking
    const localPagesReadRef = useRef(0);

    const sendReadingStats = async () => {
        if (localPagesReadRef.current > 0) {
            const pagesToSync = localPagesReadRef.current;
            localPagesReadRef.current = 0;
            if (!navigator.onLine) {
                await enqueueReadingStats(bookId, pagesToSync, pageNumber, numPages || 1).catch(() => {});
                return;
            }
            try {
                await supabase.rpc('update_reading_stats', { pages_read: pagesToSync });
            } catch (err) { 
                console.error('Error sending reading stats', err); 
                await enqueueReadingStats(bookId, pagesToSync, pageNumber, numPages || 1).catch(() => {});
            }
        }
    };

    // Cleanup Object URL + stop TTS on unmount + flush stats
    useEffect(() => {
        return () => {
            if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
            window.speechSynthesis?.cancel();
            sendReadingStats(); // Flush any unsent pages
        };
    }, []);

    // Load available TTS voices
    useEffect(() => {
        const loadVoices = () => {
            const v = window.speechSynthesis?.getVoices() || [];
            const frVoices = v.filter(voice => voice.lang.startsWith('fr'));
            const allVoices = frVoices.length > 0 ? frVoices : v;
            setTtsVoices(allVoices);
        };
        loadVoices();
        window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
        return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
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
                // Also cache the cover for offline display
                if (book.cover_url) {
                    saveCoverOffline(bookId, book.cover_url).catch(() => {});
                }
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
    }, [bookId, user]);

    // Define changePage with useCallback before it is used
    const changePage = useCallback(async (offset) => {
        const newPage = Math.min(Math.max(1, pageNumber + offset), numPages || 1);
        if (newPage !== pageNumber) {
            localPagesReadRef.current += 1;
        }
        setPageNumber(newPage);
        if (numPages) await saveReadingProgress(bookId, newPage, numPages);
        
        // Flush stats every 5 pages
        if (localPagesReadRef.current >= 5) {
            sendReadingStats();
        }
    }, [pageNumber, numPages, bookId]);

    useEffect(() => {
        let active = true;
        const init = async () => {
            if (!active) return;
            if (!navigator.onLine) {
                setLoading(true);
                try {
                    const blob = await getOfflineBook(bookId);
                    const meta = await getBookMeta(bookId);
                    if (!active) return;
                    if (blob) {
                        setBlobAsPdf(blob);
                        setBookMeta(meta);
                        const p = await getReadingProgress(bookId);
                        if (p?.currentPage && active) setPageNumber(p.currentPage);
                    } else {
                        setError("Ce livre n'est pas téléchargé. Connectez-vous à Internet.");
                    }
                } catch {
                    if (active) setError("Erreur de chargement hors-ligne.");
                } finally {
                    if (active) setLoading(false);
                }
            } else {
                if (authLoading) return;
                if (!user) { navigate('/login'); return; }
                loadBook();
            }
        };

        const timer = setTimeout(init, 0);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [user, authLoading, navigate, loadBook, bookId]);

    // ─── PINCH TO ZOOM (smooth with CSS transform) ────────────────────────
    const getDistance = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const [visualScale, setVisualScale] = useState(1); // CSS transform scale on top of base scale
    const isPinching = useRef(false);

    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;

        let rafId = null;
        let pendingScale = 1;

        const onTouchStart = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                isPinching.current = true;
                pinchRef.current.startDist = getDistance(e.touches[0], e.touches[1]);
                pinchRef.current.startScale = scale;
                setVisualScale(1);
            } else if (e.touches.length === 1) {
                swipeRef.current.startX = e.touches[0].clientX;
                swipeRef.current.startY = e.touches[0].clientY;
                swipeRef.current.startTime = Date.now();
            }
        };

        const onTouchMove = (e) => {
            if (e.touches.length === 2 && isPinching.current) {
                e.preventDefault();
                const dist = getDistance(e.touches[0], e.touches[1]);
                const ratio = dist / pinchRef.current.startDist;
                // Clamp the visual ratio for smooth feedback
                pendingScale = Math.min(3.0, Math.max(0.4, ratio));
                
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    setVisualScale(pendingScale);
                });
            }
        };

        const onTouchEnd = (e) => {
            if (isPinching.current) {
                isPinching.current = false;
                if (rafId) cancelAnimationFrame(rafId);
                // Commit the final scale
                const finalScale = Math.min(4.0, Math.max(0.5, pinchRef.current.startScale * pendingScale));
                setScale(finalScale);
                setVisualScale(1);
                pendingScale = 1;
                return;
            }

            // Swipe detection for page turning
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
    }, [scale, scrollMode, pageNumber, numPages, changePage]);

    // ─── HANDLERS ────────────────────────
    const onDocumentLoadSuccess = (doc) => {
        setNumPages(doc.numPages);
        pdfDocRef.current = doc;
    };

    const toggleToolbar = () => {
        if (showThemePanel || showModePanel || showAudioPanel) {
            setShowThemePanel(false);
            setShowModePanel(false);
            setShowAudioPanel(false);
            return;
        }
        setShowToolbar(p => !p);
    };

    // ─── TTS FUNCTIONS (sentence-by-sentence) ────────────────────────
    const splitSentences = (text) => {
        if (!text) return [];
        return text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g)?.map(s => s.trim()).filter(s => s.length > 2) || [text];
    };

    const extractPageText = async (pgNum) => {
        if (!pdfDocRef.current) return '';
        try {
            const page = await pdfDocRef.current.getPage(pgNum);
            const content = await page.getTextContent();
            return content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
        } catch { return ''; }
    };

    const speakSentence = (sentences, idx) => {
        if (!ttsActiveRef.current || idx >= sentences.length) {
            // Page finished — auto-advance?
            if (ttsActiveRef.current && ttsAutoAdvance && pageNumber < (numPages || 1)) {
                const nextPg = pageNumber + 1;
                setPageNumber(nextPg);
                saveReadingProgress(bookId, nextPg, numPages);
                // Load next page text after a short delay
                setTimeout(async () => {
                    if (!ttsActiveRef.current) return;
                    const text = await extractPageText(nextPg);
                    const newSentences = splitSentences(text);
                    if (newSentences.length) {
                        setTtsSentences(newSentences);
                        setTtsSentenceIdx(0);
                        speakSentence(newSentences, 0);
                    } else { ttsStop(); }
                }, 400);
            } else { ttsStop(); }
            return;
        }
        window.speechSynthesis.cancel();
        setTtsSentenceIdx(idx);
        const utter = new SpeechSynthesisUtterance(sentences[idx]);
        if (ttsVoices[ttsVoiceIdx]) utter.voice = ttsVoices[ttsVoiceIdx];
        utter.rate = ttsRate;
        utter.onend = () => speakSentence(sentences, idx + 1);
        utter.onerror = () => ttsStop();
        window.speechSynthesis.speak(utter);
        setTtsPlaying(true); setTtsPaused(false);
    };

    const ttsSpeak = async (fromIdx) => {
        if (!window.speechSynthesis) { alert('Audio non supporté.'); return; }
        if (ttsPaused && typeof fromIdx === 'undefined') {
            window.speechSynthesis.resume(); setTtsPaused(false); setTtsPlaying(true); return;
        }
        window.speechSynthesis.cancel();
        ttsActiveRef.current = true;
        if (ttsSentences.length && typeof fromIdx === 'number') {
            speakSentence(ttsSentences, fromIdx); return;
        }
        setTtsLoading(true);
        const text = await extractPageText(pageNumber);
        const sentences = splitSentences(text);
        setTtsLoading(false);
        if (!sentences.length) { alert('Aucun texte sur cette page.'); ttsActiveRef.current = false; return; }
        setTtsSentences(sentences);
        const startIdx = typeof fromIdx === 'number' ? fromIdx : 0;
        setTtsSentenceIdx(startIdx);
        speakSentence(sentences, startIdx);
    };

    const ttsPause = () => { window.speechSynthesis.pause(); setTtsPaused(true); setTtsPlaying(false); };
    const ttsStop = () => { window.speechSynthesis.cancel(); ttsActiveRef.current = false; setTtsPlaying(false); setTtsPaused(false); };
    const ttsSkipNext = () => { if (ttsSentenceIdx < ttsSentences.length - 1) ttsSpeak(ttsSentenceIdx + 1); };
    const ttsSkipPrev = () => { if (ttsSentenceIdx > 0) ttsSpeak(ttsSentenceIdx - 1); else ttsSpeak(0); };
    const ttsJumpToSentence = (idx) => ttsSpeak(idx);

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
                <button className="btn btn-primary" onClick={() => navigate('/home')}>Retour</button>
            </div>
        </div>
    );

    // ─── RENDER ────────────────────────
    return (
        <div className={`reader-container theme-${theme}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: currentTheme.bg, transition: 'background 0.4s ease' }}>
            
            {/* ── Top Toolbar ── */}
            <div className={`reader-toolbar ${!showToolbar ? 'hidden' : ''}`} style={{ flexShrink: 0, zIndex: 100 }}>
                <button onClick={() => navigate('/home')}><span className="material-symbols-outlined">arrow_back</span></button>
                <div className="reader-toolbar-title line-clamp-1">{bookMeta?.title || 'Lecture'}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.5, s - 0.2)); }} title="Dézoomer">
                        <span className="material-symbols-outlined">zoom_out</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(4.0, s + 0.2)); }} title="Zoomer">
                        <span className="material-symbols-outlined">zoom_in</span>
                    </button>
                </div>
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
                    justifyContent: scrollMode === 'paginated' ? 'center' : 'flex-start',
                    padding: scrollMode === 'paginated' ? '16px 0' : '8px 0',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    touchAction: scale > 1 ? 'pan-x pan-y' : (scrollMode === 'horizontal' ? 'pan-x' : 'pan-y'),
                }}
                onContextMenu={(e) => e.preventDefault()}
                onClick={toggleToolbar}
            >
                {/* Visual scale wrapper — GPU-accelerated CSS transform during pinch */}
                <div style={{
                    transform: `scale(${visualScale})`,
                    transformOrigin: 'center center',
                    transition: visualScale === 1 ? 'transform 0.15s ease-out' : 'none',
                    willChange: 'transform',
                    display: 'flex',
                    flexDirection: scrollMode === 'horizontal' ? 'row' : 'column',
                    alignItems: 'center',
                }}>
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
                </div>{/* end visual scale wrapper */}
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

            {/* ── Audio TTS Panel (enhanced) ── */}
            {showAudioPanel && (
                <div style={{
                    position: 'absolute', bottom: 80, left: 0, right: 0, zIndex: 200,
                    background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
                    borderRadius: '20px 20px 0 0', padding: '20px 16px 28px',
                    animation: 'slideUp 0.3s ease', maxHeight: '55vh', overflowY: 'auto'
                }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>Lecture Audio</h3>

                    {/* Current sentence display */}
                    {ttsSentences.length > 0 && (
                        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 700 }}>Phrase {ttsSentenceIdx + 1} / {ttsSentences.length}</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Page {pageNumber}</span>
                            </div>
                            <p style={{ fontSize: 13, color: '#fff', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
                                "{ttsSentences[ttsSentenceIdx]?.substring(0, 120)}{ttsSentences[ttsSentenceIdx]?.length > 120 ? '…' : ''}"
                            </p>
                            {/* Sentence progress bar */}
                            <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 10 }}>
                                <div style={{ height: '100%', width: `${((ttsSentenceIdx + 1) / ttsSentences.length) * 100}%`, background: 'var(--color-primary)', borderRadius: 2, transition: 'width 0.3s ease' }} />
                            </div>
                        </div>
                    )}

                    {/* Transport controls */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <button onClick={ttsStop} disabled={!ttsPlaying && !ttsPaused} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ttsPlaying || ttsPaused ? '#fff' : 'rgba(255,255,255,0.25)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>stop</span>
                        </button>
                        <button onClick={ttsSkipPrev} disabled={!ttsPlaying && !ttsPaused} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ttsSentenceIdx > 0 ? '#fff' : 'rgba(255,255,255,0.25)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>skip_previous</span>
                        </button>
                        <button onClick={() => ttsPlaying ? ttsPause() : ttsSpeak()} disabled={ttsLoading} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(255,215,0,0.3)' }}>
                            {ttsLoading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.3)' }} />
                            : <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#000' }}>{ttsPlaying ? 'pause' : 'play_arrow'}</span>}
                        </button>
                        <button onClick={ttsSkipNext} disabled={!ttsPlaying && !ttsPaused} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ttsSentenceIdx < ttsSentences.length - 1 ? '#fff' : 'rgba(255,255,255,0.25)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>skip_next</span>
                        </button>
                        <button onClick={() => { ttsStop(); changePage(1); }} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>fast_forward</span>
                        </button>
                    </div>

                    {/* Speed + Auto-advance row */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Vitesse</span>
                                <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 700 }}>{ttsRate.toFixed(1)}x</span>
                            </div>
                            <input type="range" min="0.5" max="2.5" step="0.1" value={ttsRate} onChange={e => setTtsRate(parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
                        </div>
                        <button onClick={() => setTtsAutoAdvance(p => !p)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 10px', borderRadius: 10, background: ttsAutoAdvance ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.05)', border: ttsAutoAdvance ? '1px solid var(--color-primary)' : '1px solid transparent', minWidth: 56 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: ttsAutoAdvance ? 'var(--color-primary)' : 'rgba(255,255,255,0.4)' }}>auto_stories</span>
                            <span style={{ fontSize: 9, color: ttsAutoAdvance ? 'var(--color-primary)' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Auto</span>
                        </button>
                    </div>

                    {/* Voice selector */}
                    {ttsVoices.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Voix</span>
                            <select value={ttsVoiceIdx} onChange={e => setTtsVoiceIdx(Number(e.target.value))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', fontSize: 12 }}>
                                {ttsVoices.map((v, i) => <option key={i} value={i} style={{ background: '#1a1a1a' }}>{v.name} ({v.lang})</option>)}
                            </select>
                        </div>
                    )}

                    {/* Sentence list (jump to) */}
                    {ttsSentences.length > 1 && (
                        <div>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Phrases ({ttsSentences.length})</span>
                            <div style={{ maxHeight: 120, overflowY: 'auto', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                                {ttsSentences.map((s, i) => (
                                    <button key={i} onClick={() => ttsJumpToSentence(i)} style={{
                                        display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', textAlign: 'left',
                                        padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        background: i === ttsSentenceIdx ? 'rgba(255,215,0,0.1)' : 'transparent',
                                        transition: 'background 0.2s ease'
                                    }}>
                                        <span style={{ fontSize: 10, color: i === ttsSentenceIdx ? 'var(--color-primary)' : 'rgba(255,255,255,0.3)', fontWeight: 700, minWidth: 20, flexShrink: 0 }}>{i + 1}</span>
                                        <span style={{ fontSize: 11, color: i === ttsSentenceIdx ? '#fff' : 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{s.substring(0, 80)}{s.length > 80 ? '…' : ''}</span>
                                        {i === ttsSentenceIdx && ttsPlaying && <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--color-primary)', marginLeft: 'auto', flexShrink: 0 }}>volume_up</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
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
                <button onClick={(e) => { e.stopPropagation(); setShowThemePanel(false); setShowAudioPanel(false); setShowModePanel(p => !p); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: showModePanel ? 'var(--color-primary)' : 'inherit' }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                        {SCROLL_MODES.find(m => m.id === scrollMode)?.icon || 'auto_stories'}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Mode</span>
                </button>

                {/* Audio TTS */}
                <button onClick={(e) => { e.stopPropagation(); setShowThemePanel(false); setShowModePanel(false); setShowAudioPanel(p => !p); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: showAudioPanel ? 'var(--color-primary)' : (ttsPlaying ? '#4CAF50' : 'inherit') }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{ttsPlaying ? 'volume_up' : 'headphones'}</span>
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Audio</span>
                </button>

                {/* AI Chat */}
                <button onClick={(e) => { e.stopPropagation(); setShowChat(true); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 22, background: 'linear-gradient(135deg, var(--color-primary), #FF8C00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>smart_toy</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-primary)' }}>IA</span>
                </button>

                {/* Theme / Color */}
                <button onClick={(e) => { e.stopPropagation(); setShowModePanel(false); setShowAudioPanel(false); setShowThemePanel(p => !p); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: showThemePanel ? 'var(--color-primary)' : 'inherit' }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>palette</span>
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Couleur</span>
                </button>
            </div>
            {/* AI Chat overlay */}
            <BookChat
                isOpen={showChat}
                onClose={() => setShowChat(false)}
                extractPageText={extractPageText}
                pageNumber={pageNumber}
                numPages={numPages}
                bookTitle={bookMeta?.title}
            />
        </div>
    );
}
