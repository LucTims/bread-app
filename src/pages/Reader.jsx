import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
    getOfflineBook, getBookMeta, saveReadingProgress, getReadingProgress,
    saveBookOffline, saveCoverOffline, enqueueReadingStats,
    getBookNotes, saveBookNote, deleteBookNote
} from '../lib/offlineStore';
import { supabase, getFreeBooks } from '../lib/supabase';
import { checkRealConnectivity } from '../lib/connectivity';
import {
    ArrowLeft2, MagicStar, Edit2, Bookmark, Bookmark2, Trash, NoteText,
    Headphones, VolumeHigh, Stop, Previous, Next, Play, Pause, Forward, Danger
} from 'iconsax-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ReactReader } from 'react-reader';
import BookChat from '../components/BookChat';
import { fetchElevenLabsVoices, generateElevenLabsSpeech, getElevenLabsCredits } from '../lib/elevenLabs';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF Worker for Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Fixed reading text color — literal value (not a CSS var: epub content renders
// inside an iframe where the parent's custom properties don't resolve).
const READER_TEXT = '#111827';

export default function Reader() {
    const { bookId } = useParams();
    const { user, profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [pdfFile, setPdfFile] = useState(null);
    const [bookMeta, setBookMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // PDF State
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [zoomFactor, setZoomFactor] = useState(1);
    const [pageAspect, setPageAspect] = useState(1.414);
    const [containerWidth, setContainerWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 360));
    const [showToolbar, setShowToolbar] = useState(true);
    const [epubLocation, setEpubLocation] = useState(null);
    const renditionRef = useRef(null);
    const pageNumberRef = useRef(1);
    useEffect(() => { pageNumberRef.current = pageNumber; }, [pageNumber]);

    // Continuous-scroll page rendering (PDF): pages near the viewport render for
    // real, everything else stays a lightweight same-size placeholder — this is
    // what keeps scrolling smooth on long books instead of rendering all pages at once.
    const [renderedPages, setRenderedPages] = useState(() => new Set());
    const pageNodeRefs = useRef({});
    const ioRef = useRef(null);
    const didInitialScroll = useRef(false);

    // Panels
    const [showAnnotatePanel, setShowAnnotatePanel] = useState(false);
    const [showAudioPanel, setShowAudioPanel] = useState(false);
    const [showChat, setShowChat] = useState(false);

    // Notes / bookmarks
    const [notes, setNotes] = useState([]);
    const [noteDraft, setNoteDraft] = useState('');

    // Floating page indicator (shown briefly while scrolling)
    const [showPageIndicator, setShowPageIndicator] = useState(false);
    const pageIndicatorTimer = useRef(null);
    const progressSaveTimer = useRef(null);
    const scrollRafRef = useRef(null);

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

    // ElevenLabs States
    const [useElevenLabs, setUseElevenLabs] = useState(false);
    const [elevenVoices, setElevenVoices] = useState([]);
    const [elevenVoiceId, setElevenVoiceId] = useState('');
    const [elevenCredits, setElevenCredits] = useState(null);
    const elevenAudioRef = useRef(null);

    // Touch / Pinch zoom
    const pinchRef = useRef({ startDist: 0, startScale: 1 });
    const isPinching = useRef(false);
    const canvasRef = useRef(null);
    const pdfUrlRef = useRef(null);

    // Reading Stats Tracking
    const localPagesReadRef = useRef(0);

    const sendReadingStats = async () => {
        if (localPagesReadRef.current > 0) {
            const pagesToSync = localPagesReadRef.current;
            localPagesReadRef.current = 0;
            if (bookId.startsWith('local_')) return;
            const isOnline = await checkRealConnectivity();
            if (!isOnline) {
                await enqueueReadingStats(bookId, pagesToSync, pageNumberRef.current, numPages || 1).catch(() => {});
                return;
            }
            try {
                await supabase.rpc('update_reading_stats', { pages_read: pagesToSync });
            } catch (err) {
                console.error('Error sending reading stats', err);
                await enqueueReadingStats(bookId, pagesToSync, pageNumberRef.current, numPages || 1).catch(() => {});
            }
        }
    };

    // Cleanup Object URL + stop TTS on unmount + flush stats
    useEffect(() => {
        return () => {
            if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
            if (elevenAudioRef.current) {
                elevenAudioRef.current.pause();
                elevenAudioRef.current = null;
            }
            window.speechSynthesis?.cancel();
            sendReadingStats(); // Flush any unsent pages
        };
    }, []);

    // TTS Voices load
    useEffect(() => {
        const loadVoices = () => {
            const allVoices = window.speechSynthesis?.getVoices() || [];
            const frVoices = allVoices.filter(v => v.lang.startsWith('fr'));
            setTtsVoices(frVoices.length > 0 ? frVoices : allVoices);
        };
        loadVoices();
        window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
        return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
    }, []);

    // ElevenLabs load
    useEffect(() => {
        if (showAudioPanel) {
            fetchElevenLabsVoices().then(voices => {
                setElevenVoices(voices);
                if (voices.length > 0 && !elevenVoiceId) {
                    setElevenVoiceId(voices[0].voice_id);
                }
            });
            getElevenLabsCredits().then(setElevenCredits);
        }
    }, [showAudioPanel, elevenVoiceId]);

    // Notes / bookmarks load
    useEffect(() => {
        getBookNotes(bookId).then(setNotes);
    }, [bookId]);

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
            // 1. Check offline storage first (instant local access for saved books & imported files)
            const offlinePdfBlob = await getOfflineBook(bookId);
            const offlineMeta = await getBookMeta(bookId);

            if (offlinePdfBlob) {
                const meta = offlineMeta || {};
                if (!meta.format) {
                    const isEpub = offlinePdfBlob.type === 'application/epub+zip' ||
                                  (offlinePdfBlob.name && offlinePdfBlob.name.toLowerCase().endsWith('.epub'));
                    meta.format = isEpub ? 'epub' : 'pdf';
                }

                if (meta.is_subscription) {
                    if (profile?.subscription_end_date && new Date(profile.subscription_end_date) < new Date()) {
                        throw new Error("Votre abonnement a expiré. Connectez-vous à Internet et renouvelez-le sur BoomBooks pour continuer à lire ce livre.");
                    }
                }

                setBlobAsPdf(offlinePdfBlob);
                setBookMeta(meta);

                const progress = await getReadingProgress(bookId);
                if (progress?.currentPage) {
                    if (typeof progress.currentPage === 'string' && progress.currentPage.startsWith('epubcfi')) {
                        setEpubLocation(progress.currentPage);
                    } else {
                        setPageNumber(Number(progress.currentPage));
                    }
                }
                setLoading(false);
                return;
            }

            // 2. Book is not cached locally
            if (bookId.startsWith('local_')) {
                throw new Error("Ce document local n'est plus disponible sur l'appareil.");
            }

            if (!user) {
                if (authLoading) return;
                throw new Error("Veuillez vous connecter avec votre compte pour lire cet ouvrage.");
            }

            // Check network availability
            const isOnline = await checkRealConnectivity();
            if (!isOnline && typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error("Ce livre n'est pas encore téléchargé. Connectez-vous à Internet pour le lire.");
            }

            // Verify access: Admin has full access to all books
            let hasAccess = false;
            let hasAccessViaSubscription = false;

            if (profile?.role === 'admin') {
                hasAccess = true;
            } else {
                const { data: access } = await supabase
                    .from('user_book_access').select('id')
                    .eq('user_id', user.id).eq('book_id', bookId).maybeSingle();

                hasAccess = !!access;

                if (!hasAccess) {
                    const { data: orders } = await supabase.from('orders')
                        .select('id, order_items(book_id)')
                        .eq('user_id', user.id).eq('status', 'paid');
                    hasAccess = orders?.some(o => o.order_items?.some(oi => oi.book_id === bookId));
                }
                if (!hasAccess) {
                    const freeBooks = await getFreeBooks();
                    hasAccess = freeBooks.some(fb => fb.id === bookId);
                }

                if (!hasAccess && profile?.subscription_plan) {
                    const isSubActive = new Date(profile.subscription_end_date) > new Date();
                    const plan = (profile.subscription_plan || '').toLowerCase();
                    const isOfflinePlan = plan.includes('batisseur') || plan.includes('discipline');

                    if (isSubActive && isOfflinePlan) {
                        hasAccess = true;
                        hasAccessViaSubscription = true;
                    } else if (isSubActive && !isOfflinePlan) {
                        throw new Error("Votre abonnement Lecteur ne permet pas le téléchargement hors-ligne sur Bread. Passez au forfait Bâtisseur.");
                    } else if (!isSubActive) {
                        throw new Error("Votre abonnement a expiré. Veuillez le renouveler sur BoomBooks pour télécharger ce livre.");
                    }
                }
            }

            if (!hasAccess) throw new Error("Accès non autorisé. Vous n'avez pas accès à ce livre.");

            const { data: book, error: bookErr } = await supabase.from('books').select('*').eq('id', bookId).single();
            if (bookErr || !book) throw new Error('Livre introuvable dans le catalogue.');

            const rawPath = book.file_path || book.file_url || `pdfs/${bookId}.pdf`;
            const cleanPath = rawPath.replace(/^\/+/, '');
            let blob = null;

            try {
                if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
                    const r = await fetch(cleanPath);
                    if (r.ok) blob = await r.blob();
                } else {
                    // 1. Try 'books' bucket direct download
                    const { data: directBlob, error: dlErr } = await supabase.storage.from('books').download(cleanPath);
                    if (!dlErr && directBlob) {
                        blob = directBlob;
                    } else {
                        // 2. Try signed URL from 'books'
                        const { data: sd } = await supabase.storage.from('books').createSignedUrl(cleanPath, 3600);
                        if (sd?.signedUrl) {
                            const r = await fetch(sd.signedUrl);
                            if (r.ok) blob = await r.blob();
                        }
                    }

                    // 3. Fallback to 'books-pdfs' bucket
                    if (!blob) {
                        const { data: b2Blob, error: b2Err } = await supabase.storage.from('books-pdfs').download(cleanPath);
                        if (!b2Err && b2Blob) {
                            blob = b2Blob;
                        } else {
                            const { data: sd2 } = await supabase.storage.from('books-pdfs').createSignedUrl(cleanPath, 3600);
                            if (sd2?.signedUrl) {
                                const r = await fetch(sd2.signedUrl);
                                if (r.ok) blob = await r.blob();
                            }
                        }
                    }

                    // 4. Fallback to public URL
                    if (!blob) {
                        const { data: pubData } = supabase.storage.from('books-pdfs').getPublicUrl(cleanPath);
                        if (pubData?.publicUrl) {
                            const r = await fetch(pubData.publicUrl);
                            if (r.ok) blob = await r.blob();
                        }
                    }
                }
            } catch (dlException) {
                console.error('[Reader] Download exception:', dlException);
            }

            if (!blob) throw new Error("Le fichier du livre n'a pas pu être téléchargé. Vérifiez votre connexion Internet.");

            const format = (book.format || (cleanPath.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf')).toLowerCase();
            const bookMetaToSave = {
                title: book.title,
                author: book.author,
                cover_url: book.cover_url,
                is_subscription: hasAccessViaSubscription,
                format: format
            };

            await saveBookOffline(bookId, blob, bookMetaToSave);
            if (book.cover_url) {
                saveCoverOffline(bookId, book.cover_url).catch(() => {});
            }

            setBlobAsPdf(blob);
            setBookMeta(bookMetaToSave);

            const progress = await getReadingProgress(bookId);
            if (progress?.currentPage) {
                if (typeof progress.currentPage === 'string' && progress.currentPage.startsWith('epubcfi')) {
                    setEpubLocation(progress.currentPage);
                } else {
                    setPageNumber(Number(progress.currentPage));
                }
            }
        } catch (err) {
            console.error('[Reader] load error:', err);
            setError(err.message || "Erreur lors du chargement du livre.");
        } finally {
            setLoading(false);
        }
    }, [bookId, user, profile, authLoading]);

    // Guarded so a transient user/profile reference change (auth context re-emits
    // on token refresh etc.) doesn't re-trigger a full reload of the book.
    const loadedForBookId = useRef(null);
    useEffect(() => {
        if (authLoading || loadedForBookId.current === bookId) return;
        loadedForBookId.current = bookId;
        loadBook();
    }, [authLoading, bookId, loadBook]);

    // ─── Jump to a page — scrolls smoothly and makes sure it's actually rendered ───
    const goToPage = useCallback((pg) => {
        if (!numPages) return;
        const clamped = Math.min(Math.max(1, pg), numPages);
        setRenderedPages(prev => {
            const next = new Set(prev);
            [clamped - 1, clamped, clamped + 1].forEach(p => { if (p >= 1 && p <= numPages) next.add(p); });
            return next;
        });
        requestAnimationFrame(() => {
            pageNodeRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [numPages]);

    const skipToNextPage = () => {
        ttsStop();
        if (bookMeta?.format === 'epub' && renditionRef.current) renditionRef.current.next();
        else goToPage(pageNumberRef.current + 1);
    };

    // ─── EPUB HANDLERS ────────────────────────
    const onLocationChanged = (epubcif) => {
        setEpubLocation(epubcif);
        saveReadingProgress(bookId, epubcif, 1);
        localPagesReadRef.current += 1;
        if (localPagesReadRef.current >= 5) {
            sendReadingStats();
        }
    };

    // ─── PDF continuous-scroll page tracking ────────────────────────
    // Page dimensions are read once (page 1) — books almost always share the
    // same page size, so this avoids per-page async lookups and layout jumps.
    const onDocumentLoadSuccess = async (doc) => {
        setNumPages(doc.numPages);
        pdfDocRef.current = doc;
        try {
            const page1 = await doc.getPage(1);
            const vp = page1.getViewport({ scale: 1 });
            setPageAspect(vp.height / vp.width);
        } catch { /* keep fallback aspect */ }
    };

    const registerPageNode = useCallback((pg) => (node) => {
        if (node) {
            pageNodeRefs.current[pg] = node;
            ioRef.current?.observe(node);
        } else {
            delete pageNodeRefs.current[pg];
        }
    }, []);

    // Grows the rendered-pages window as pages approach the viewport, and prunes
    // pages far from where we're currently reading so memory stays bounded on long books.
    useEffect(() => {
        if (bookMeta?.format === 'epub' || !numPages) return;
        const io = new IntersectionObserver((entries) => {
            setRenderedPages(prev => {
                let changed = false;
                const next = new Set(prev);
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const pg = Number(entry.target.dataset.page);
                        if (!next.has(pg)) { next.add(pg); changed = true; }
                    }
                });
                for (const pg of next) {
                    if (Math.abs(pg - pageNumberRef.current) > 25) { next.delete(pg); changed = true; }
                }
                return changed ? next : prev;
            });
        }, { root: canvasRef.current, rootMargin: '150% 0px', threshold: 0.01 });
        ioRef.current = io;
        Object.values(pageNodeRefs.current).forEach(node => node && io.observe(node));
        return () => io.disconnect();
    }, [numPages, bookMeta?.format]);

    // One-time scroll to the resumed page once the document & its nodes exist
    useEffect(() => {
        if (bookMeta?.format === 'epub' || !numPages || didInitialScroll.current) return;
        didInitialScroll.current = true;
        const target = Math.min(Math.max(1, pageNumber), numPages);
        setRenderedPages(prev => {
            const next = new Set(prev);
            [target - 1, target, target + 1].forEach(p => { if (p >= 1 && p <= numPages) next.add(p); });
            return next;
        });
        if (target > 1) {
            requestAnimationFrame(() => pageNodeRefs.current[target]?.scrollIntoView({ block: 'start' }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [numPages, bookMeta?.format]);

    // Track which page is centered in view while scrolling — drives the progress
    // bar, the floating page indicator, and where reading progress gets saved.
    const handleScroll = useCallback(() => {
        if (bookMeta?.format === 'epub') return;
        if (scrollRafRef.current) return;
        scrollRafRef.current = requestAnimationFrame(() => {
            scrollRafRef.current = null;
            const container = canvasRef.current;
            if (!container || !numPages) return;
            const referenceY = container.scrollTop + container.clientHeight * 0.35;
            let best = pageNumberRef.current;
            let bestTop = -Infinity;
            for (const [pg, node] of Object.entries(pageNodeRefs.current)) {
                if (!node) continue;
                const top = node.offsetTop;
                if (top <= referenceY && top > bestTop) { bestTop = top; best = Number(pg); }
            }
            if (best !== pageNumberRef.current) {
                localPagesReadRef.current += 1;
                setPageNumber(best);
                if (localPagesReadRef.current >= 5) sendReadingStats();
            }
            setShowPageIndicator(true);
            if (pageIndicatorTimer.current) clearTimeout(pageIndicatorTimer.current);
            pageIndicatorTimer.current = setTimeout(() => setShowPageIndicator(false), 900);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [numPages, bookMeta?.format]);

    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    // Debounced progress persistence — avoids writing on every page crossed during a fast scroll
    useEffect(() => {
        if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
        if (!numPages) return;
        progressSaveTimer.current = setTimeout(() => {
            saveReadingProgress(bookId, pageNumber, numPages);
        }, 500);
        return () => clearTimeout(progressSaveTimer.current);
    }, [pageNumber, numPages, bookId]);

    // Fit-to-width sizing — the page always fills the screen; pinch multiplies from there
    useLayoutEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        // Measure synchronously before paint so the very first render already
        // uses the real width — avoids a flash (or a stuck small render on
        // fast-loading files) while ResizeObserver's first callback catches up.
        if (el.clientWidth > 0) setContainerWidth(el.clientWidth);
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) setContainerWidth(entry.contentRect.width);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const pageWidth = Math.max(200, containerWidth) * zoomFactor;

    // ─── PINCH TO ZOOM (smooth with CSS transform, commits to real width on release) ────────────────────────
    const getDistance = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const [visualScale, setVisualScale] = useState(1);

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
                pinchRef.current.startScale = zoomFactor;
                setVisualScale(1);
            }
        };

        const onTouchMove = (e) => {
            if (e.touches.length === 2 && isPinching.current) {
                e.preventDefault();
                const dist = getDistance(e.touches[0], e.touches[1]);
                const ratio = dist / pinchRef.current.startDist;
                pendingScale = Math.min(3.0, Math.max(0.5, ratio));
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => setVisualScale(pendingScale));
            }
        };

        const onTouchEnd = () => {
            if (isPinching.current) {
                isPinching.current = false;
                if (rafId) cancelAnimationFrame(rafId);
                const finalScale = Math.min(4.0, Math.max(1, pinchRef.current.startScale * pendingScale));
                setZoomFactor(finalScale);
                setVisualScale(1);
                pendingScale = 1;
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
    }, [zoomFactor]);

    // Update EPUB font size dynamically when zoom changes
    useEffect(() => {
        if (bookMeta?.format === 'epub' && renditionRef.current) {
            try {
                renditionRef.current.themes.fontSize(`${zoomFactor * 100}%`);
            } catch (err) {}
        }
    }, [zoomFactor, bookMeta?.format]);

    // ─── Tap to toggle all chrome (or close an open panel first) ────────────────────────
    const toggleToolbar = () => {
        if (showAnnotatePanel || showAudioPanel) {
            setShowAnnotatePanel(false);
            setShowAudioPanel(false);
            return;
        }
        setShowToolbar(p => !p);
    };

    // ─── Notes & bookmarks ────────────────────────
    const isBookmarked = notes.some(n => n.page === pageNumber && n.isBookmark);

    const toggleBookmark = async () => {
        const existing = notes.find(n => n.page === pageNumber && n.isBookmark);
        if (existing) {
            await deleteBookNote(bookId, existing.id);
            setNotes(prev => prev.filter(n => n.id !== existing.id));
        } else {
            const note = await saveBookNote(bookId, { page: pageNumber, isBookmark: true });
            setNotes(prev => [...prev, note].sort((a, b) => a.page - b.page));
        }
    };

    const addNote = async () => {
        if (!noteDraft.trim()) return;
        const note = await saveBookNote(bookId, { page: pageNumber, text: noteDraft.trim(), isBookmark: false });
        setNotes(prev => [...prev, note].sort((a, b) => a.page - b.page));
        setNoteDraft('');
    };

    const removeNote = async (id) => {
        await deleteBookNote(bookId, id);
        setNotes(prev => prev.filter(n => n.id !== id));
    };

    const jumpToNote = (page) => {
        setShowAnnotatePanel(false);
        if (bookMeta?.format === 'epub') return;
        goToPage(page);
    };

    // ─── TTS FUNCTIONS (fluid paragraph-by-paragraph) ────────────────────────
    const chunkTextForTTS = (text) => {
        if (!text) return [];
        // Corriger l'extraction de texte PDF (mots coupés par des tirets en fin de ligne)
        let cleaned = text.replace(/-\s+/g, '');
        // Corriger l'espacement autour de la ponctuation pour que le TTS l'interprète bien
        cleaned = cleaned.replace(/\s+([.,;:?!])/g, '$1');
        
        // Découper d'abord par phrases
        const sentences = cleaned.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g)?.map(s => s.trim()).filter(s => s.length > 1) || [cleaned];
        
        // Regrouper les phrases en morceaux plus grands (ex: ~300 caractères)
        // Cela permet à l'IA (ElevenLabs) ou au TTS natif d'avoir le contexte pour l'intonation
        // et de lire de manière beaucoup plus fluide sans pause hachée à chaque point.
        const chunks = [];
        let currentChunk = '';
        
        for (const sentence of sentences) {
            if (!currentChunk) {
                currentChunk = sentence;
            } else if (currentChunk.length + sentence.length < 350) {
                currentChunk += ' ' + sentence;
            } else {
                chunks.push(currentChunk);
                currentChunk = sentence;
            }
        }
        if (currentChunk) chunks.push(currentChunk);
        
        return chunks;
    };

    const extractPageText = async (pgNum) => {
        if (bookMeta?.format === 'epub' && renditionRef.current) {
            try {
                const loc = renditionRef.current.currentLocation();
                if (loc && loc.start) {
                    const epub = renditionRef.current.book;
                    const spineItem = epub.spine.get(loc.start.cfi);
                    await spineItem.load(epub.load.bind(epub));
                    return spineItem.document.body.textContent.replace(/\s+/g, ' ').trim();
                }
            } catch { return ''; }
        }
        if (!pdfDocRef.current) return '';
        try {
            const page = await pdfDocRef.current.getPage(pgNum);
            const content = await page.getTextContent();
            return content.items.map(item => item.str).join(' ').trim();
        } catch { return ''; }
    };

    const speakSentence = async (sentences, idx) => {
        if (!ttsActiveRef.current || idx >= sentences.length) {
            // Page finished — auto-advance?
            if (ttsActiveRef.current && ttsAutoAdvance && pageNumberRef.current < (numPages || 1)) {
                const nextPg = pageNumberRef.current + 1;
                if (bookMeta?.format === 'epub' && renditionRef.current) renditionRef.current.next();
                else goToPage(nextPg);
                // Load next page text after a short delay
                setTimeout(async () => {
                    if (!ttsActiveRef.current) return;
                    const text = await extractPageText(nextPg);
                    const newSentences = chunkTextForTTS(text);
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
        if (elevenAudioRef.current) { elevenAudioRef.current.pause(); elevenAudioRef.current = null; }

        setTtsSentenceIdx(idx);
        setTtsPlaying(true); setTtsPaused(false);

        if (useElevenLabs && elevenVoiceId) {
            let audioUrl = null;
            const isOnline = await checkRealConnectivity();
            if (isOnline) {
                setTtsLoading(true);
                try {
                    audioUrl = await generateElevenLabsSpeech(sentences[idx], elevenVoiceId);
                } catch (err) {
                    audioUrl = null;
                }
                setTtsLoading(false);
            }
            if (!ttsActiveRef.current) return;
            if (audioUrl) {
                const audio = new Audio(audioUrl);
                elevenAudioRef.current = audio;
                audio.playbackRate = ttsRate;
                audio.onended = () => { URL.revokeObjectURL(audioUrl); speakSentence(sentences, idx + 1); };
                audio.onerror = () => { URL.revokeObjectURL(audioUrl); ttsStop(); };
                audio.play().catch(() => ttsStop());
                if (idx % 2 === 0) getElevenLabsCredits().then(setElevenCredits);
                return;
            }
            // Fall back seamlessly to native browser SpeechSynthesis if offline or ElevenLabs generation fails
        }

        if (window.speechSynthesis) {
            const utter = new SpeechSynthesisUtterance(sentences[idx]);
            if (ttsVoices[ttsVoiceIdx]) utter.voice = ttsVoices[ttsVoiceIdx];
            utter.rate = ttsRate;
            utter.onend = () => speakSentence(sentences, idx + 1);
            utter.onerror = () => ttsStop();
            window.speechSynthesis.speak(utter);
        } else {
            ttsStop();
        }
    };

    const ttsSpeak = async (fromIdx) => {
        if (!window.speechSynthesis && !useElevenLabs) { alert('Audio non supporté.'); return; }
        if (ttsPaused && typeof fromIdx === 'undefined') {
            if (useElevenLabs && elevenAudioRef.current) elevenAudioRef.current.play();
            else window.speechSynthesis.resume();
            setTtsPaused(false); setTtsPlaying(true); return;
        }
        window.speechSynthesis.cancel();
        if (elevenAudioRef.current) { elevenAudioRef.current.pause(); elevenAudioRef.current = null; }

        ttsActiveRef.current = true;
        if (ttsSentences.length && typeof fromIdx === 'number') {
            speakSentence(ttsSentences, fromIdx); return;
        }
        setTtsLoading(true);
        const text = await extractPageText(pageNumber);
        const sentences = chunkTextForTTS(text);
        setTtsLoading(false);
        if (!sentences.length) { alert('Aucun texte sur cette page.'); ttsActiveRef.current = false; return; }
        setTtsSentences(sentences);
        const startIdx = typeof fromIdx === 'number' ? fromIdx : 0;
        setTtsSentenceIdx(startIdx);
        speakSentence(sentences, startIdx);
    };

    const ttsPause = () => {
        if (useElevenLabs && elevenAudioRef.current) elevenAudioRef.current.pause();
        else window.speechSynthesis.pause();
        setTtsPaused(true); setTtsPlaying(false);
    };
    const ttsStop = () => {
        if (elevenAudioRef.current) { elevenAudioRef.current.pause(); elevenAudioRef.current = null; }
        window.speechSynthesis.cancel();
        ttsActiveRef.current = false; setTtsPlaying(false); setTtsPaused(false);
    };
    const ttsSkipNext = () => { if (ttsSentenceIdx < ttsSentences.length - 1) ttsSpeak(ttsSentenceIdx + 1); };
    const ttsSkipPrev = () => { if (ttsSentenceIdx > 0) ttsSpeak(ttsSentenceIdx - 1); else ttsSpeak(0); };
    const ttsJumpToSentence = (idx) => ttsSpeak(idx);

    const pct = numPages ? Math.round((pageNumber / numPages) * 100) : 0;

    // ─── LOADING / ERROR ────────────────────────
    if (authLoading || loading) return (
        <div className="reader-container">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}>
                <div className="spinner" style={{ marginBottom: 20 }}></div>
                <p>Chargement...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="reader-container" style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
            <div className="empty-state" style={{ padding: 32, textAlign: 'center', maxWidth: 320 }}>
                <Danger size={44} color="var(--color-danger)" variant="Bold" style={{ marginBottom: 12 }} />
                <h2 style={{ fontSize: 18, marginBottom: 8 }}>Impossible de lire le livre</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 20, fontSize: 13 }}>{error}</p>
                <button className="btn btn-primary" onClick={() => navigate('/home')}>Retour</button>
            </div>
        </div>
    );

    // ─── RENDER ────────────────────────
    return (
        <div className="reader-container" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF' }}>

            {/* ── Top Toolbar ── */}
            <div className={`reader-toolbar ${!showToolbar ? 'hidden' : ''}`} style={{ flexShrink: 0, zIndex: 100 }}>
                <button onClick={() => navigate(-1)} aria-label="Retour">
                    <ArrowLeft2 size={22} color="currentColor" variant="Linear" />
                </button>
                <div className="reader-toolbar-title line-clamp-1">{bookMeta?.title || 'Lecture'}</div>
                <button onClick={(e) => { e.stopPropagation(); setShowChat(true); }} aria-label="Assistant IA">
                    <MagicStar size={22} color="var(--color-primary)" variant="Bold" />
                </button>
            </div>

            {/* ── Page Progress Bar ── */}
            {showToolbar && numPages && (
                <div style={{ height: 3, background: 'var(--color-border)', flexShrink: 0, zIndex: 100 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', transition: 'width 0.3s ease', borderRadius: '0 2px 2px 0' }} />
                </div>
            )}

            {/* ── Reading Area ── */}
            <div
                ref={canvasRef}
                className="reader-canvas-area hide-scrollbar"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: zoomFactor > 1 ? 'auto' : 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: zoomFactor > 1 ? 'flex-start' : 'center',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    touchAction: zoomFactor > 1 ? 'pan-x pan-y' : 'pan-y',
                }}
                onContextMenu={(e) => e.preventDefault()}
                onClick={toggleToolbar}
            >
                {/* Visual scale wrapper — GPU-accelerated CSS transform during pinch */}
                <div style={{
                    transform: `scale(${visualScale})`,
                    transformOrigin: 'center top',
                    transition: visualScale === 1 ? 'transform 0.15s ease-out' : 'none',
                    willChange: 'transform',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: zoomFactor > 1 ? 'flex-start' : 'center',
                    width: '100%',
                }}>
                {bookMeta?.format === 'epub' && pdfFile ? (
                    <div style={{ width: '100vw', height: '100%', position: 'relative' }}>
                        <ReactReader
                            url={pdfFile}
                            location={epubLocation}
                            locationChanged={onLocationChanged}
                            epubInitOptions={{ openAs: 'epub' }}
                            getRendition={(rendition) => {
                                renditionRef.current = rendition;
                                rendition.flow('scrolled-doc');
                                rendition.themes.register('custom', {
                                    body: { background: 'transparent !important', color: READER_TEXT + ' !important' },
                                    p: { color: READER_TEXT + ' !important', 'font-size': (zoomFactor * 100) + '% !important' }
                                });
                                rendition.themes.select('custom');
                            }}
                        />
                    </div>
                ) : pdfFile && (
                    <Document
                        file={pdfFile}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="spinner" style={{ margin: 'auto' }} />}
                        error={<p style={{ color: 'var(--color-text)' }}>Erreur PDF.</p>}
                    >
                        {Array.from(new Array(numPages || 0), (_, index) => {
                            const pNum = index + 1;
                            const shouldRender = renderedPages.has(pNum);
                            const placeholderHeight = pageWidth * pageAspect;
                            return (
                                <div
                                    key={`page_${pNum}`}
                                    ref={registerPageNode(pNum)}
                                    data-page={pNum}
                                    style={{
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: placeholderHeight,
                                        background: '#FFFFFF',
                                    }}
                                >
                                    {shouldRender ? (
                                        <Page
                                            pageNumber={pNum}
                                            width={pageWidth}
                                            renderAnnotationLayer={false}
                                            renderTextLayer={false}
                                        />
                                    ) : (
                                        <div style={{ width: pageWidth, height: placeholderHeight, background: '#FFFFFF' }} />
                                    )}
                                </div>
                            );
                        })}
                    </Document>
                )}
                </div>{/* end visual scale wrapper */}
            </div>

            {/* ── Floating page indicator — shown briefly while scrolling ── */}
            {showToolbar && numPages && bookMeta?.format !== 'epub' && (
                <div style={{
                    position: 'absolute', top: showToolbar ? 56 : 16, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 150, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '5px 14px',
                    borderRadius: 20, fontSize: 12, fontWeight: 700, pointerEvents: 'none',
                    transition: 'opacity 0.25s ease', opacity: showPageIndicator ? 1 : 0
                }}>
                    {pageNumber} / {numPages}
                </div>
            )}

            {/* ── Annoter Panel ── */}
            {showAnnotatePanel && (
                <div style={{
                    position: 'absolute', bottom: 80, left: 0, right: 0, zIndex: 200,
                    background: 'var(--color-surface)', boxShadow: 'var(--shadow-xl)',
                    borderRadius: '20px 20px 0 0', padding: '20px 18px 28px',
                    animation: 'slideUp 0.3s ease', maxHeight: '60vh', overflowY: 'auto'
                }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ color: 'var(--color-text)', fontSize: 15, fontWeight: 700, marginBottom: 14, textAlign: 'center' }}>
                        Annoter la page {pageNumber}
                    </h3>

                    <button onClick={toggleBookmark} style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px',
                        borderRadius: 14, marginBottom: 12,
                        background: isBookmarked ? 'var(--color-primary-light)' : 'var(--color-bg-light)',
                        border: isBookmarked ? '1.5px solid var(--color-primary)' : '1.5px solid transparent'
                    }}>
                        {isBookmarked
                            ? <Bookmark2 size={20} color="var(--color-primary-text)" variant="Bold" />
                            : <Bookmark size={20} color="var(--color-text-muted)" variant="Linear" />
                        }
                        <span style={{ fontSize: 13, fontWeight: 600, color: isBookmarked ? 'var(--color-primary-text)' : 'var(--color-text)' }}>
                            {isBookmarked ? 'Signet ajouté à cette page' : 'Ajouter un signet à cette page'}
                        </span>
                    </button>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <input
                            type="text"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Écrire une note sur cette page..."
                            style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-light)', color: 'var(--color-text)', fontSize: 13 }}
                        />
                        <button onClick={addNote} className="btn btn-primary" style={{ padding: '0 16px', borderRadius: 10 }}>
                            Ajouter
                        </button>
                    </div>

                    {notes.length > 0 && (
                        <div>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' }}>
                                Signets & notes ({notes.length})
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {notes.map(n => (
                                    <div key={n.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                        borderRadius: 10, background: 'var(--color-bg-light)'
                                    }}>
                                        <div onClick={() => jumpToNote(n.page)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                            {n.isBookmark
                                                ? <Bookmark2 size={16} color="var(--color-primary-text)" variant="Bold" style={{ flexShrink: 0 }} />
                                                : <NoteText size={16} color="var(--color-text-muted)" variant="Linear" style={{ flexShrink: 0 }} />
                                            }
                                            <div style={{ minWidth: 0 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)' }}>Page {n.page}</span>
                                                {n.text && <p className="line-clamp-1" style={{ fontSize: 12, color: 'var(--color-text)', margin: '2px 0 0' }}>{n.text}</p>}
                                            </div>
                                        </div>
                                        <button onClick={() => removeNote(n.id)} aria-label="Supprimer" style={{ flexShrink: 0, padding: 4 }}>
                                            <Trash size={16} color="var(--color-danger)" variant="Linear" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Audio TTS Panel ── */}
            {showAudioPanel && (
                <div style={{
                    position: 'absolute', bottom: 80, left: 0, right: 0, zIndex: 200,
                    background: 'var(--color-surface)', boxShadow: 'var(--shadow-xl)',
                    borderRadius: '20px 20px 0 0', padding: '20px 16px 28px',
                    animation: 'slideUp 0.3s ease', maxHeight: '55vh', overflowY: 'auto'
                }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ color: 'var(--color-text)', fontSize: 15, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>Lecture Audio</h3>

                    {/* Current chunk display */}
                    {ttsSentences.length > 0 && (
                        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-light)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 10, color: 'var(--color-primary-text)', fontWeight: 700 }}>Paragraphe {ttsSentenceIdx + 1} / {ttsSentences.length}</span>
                                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Page {pageNumber}</span>
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
                                "{ttsSentences[ttsSentenceIdx]?.substring(0, 120)}{ttsSentences[ttsSentenceIdx]?.length > 120 ? '…' : ''}"
                            </p>
                            {/* Sentence progress bar */}
                            <div style={{ height: 3, background: 'var(--color-border)', borderRadius: 2, marginTop: 10 }}>
                                <div style={{ height: '100%', width: `${((ttsSentenceIdx + 1) / ttsSentences.length) * 100}%`, background: 'var(--color-primary)', borderRadius: 2, transition: 'width 0.3s ease' }} />
                            </div>
                        </div>
                    )}

                    {/* Transport controls */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <button onClick={ttsStop} disabled={!ttsPlaying && !ttsPaused} style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Stop size={18} color={ttsPlaying || ttsPaused ? 'var(--color-text)' : 'var(--color-text-muted)'} variant="Bold" />
                        </button>
                        <button onClick={ttsSkipPrev} disabled={!ttsPlaying && !ttsPaused} style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Previous size={18} color={ttsSentenceIdx > 0 ? 'var(--color-text)' : 'var(--color-text-muted)'} variant="Bold" />
                        </button>
                        <button onClick={() => ttsPlaying ? ttsPause() : ttsSpeak()} disabled={ttsLoading} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)' }}>
                            {ttsLoading
                                ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.3)' }} />
                                : ttsPlaying ? <Pause size={24} color="#000" variant="Bold" /> : <Play size={24} color="#000" variant="Bold" />
                            }
                        </button>
                        <button onClick={ttsSkipNext} disabled={!ttsPlaying && !ttsPaused} style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Next size={18} color={ttsSentenceIdx < ttsSentences.length - 1 ? 'var(--color-text)' : 'var(--color-text-muted)'} variant="Bold" />
                        </button>
                        <button onClick={skipToNextPage} style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Forward size={18} color="var(--color-text)" variant="Linear" />
                        </button>
                    </div>

                    {/* Speed + Auto-advance row */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Vitesse</span>
                                <span style={{ fontSize: 11, color: 'var(--color-primary-text)', fontWeight: 700 }}>{ttsRate.toFixed(1)}x</span>
                            </div>
                            <input type="range" min="0.5" max="2.5" step="0.1" value={ttsRate} onChange={e => setTtsRate(parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
                        </div>
                        <button onClick={() => setTtsAutoAdvance(p => !p)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 10px', borderRadius: 10, background: ttsAutoAdvance ? 'var(--color-primary-light)' : 'var(--color-bg-light)', border: ttsAutoAdvance ? '1px solid var(--color-primary)' : '1px solid transparent', minWidth: 56 }}>
                            <VolumeHigh size={16} color={ttsAutoAdvance ? 'var(--color-primary-text)' : 'var(--color-text-muted)'} variant="Linear" />
                            <span style={{ fontSize: 9, color: ttsAutoAdvance ? 'var(--color-primary-text)' : 'var(--color-text-muted)', fontWeight: 600 }}>Auto</span>
                        </button>
                    </div>

                    {/* ElevenLabs Toggle & Voice selector */}
                    <div style={{ marginBottom: 12, background: 'var(--color-bg-light)', padding: 12, borderRadius: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Voix IA Premium</span>
                                {elevenCredits && useElevenLabs && (
                                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                                        ({elevenCredits.character_count}/{elevenCredits.character_limit} cr.)
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setUseElevenLabs(!useElevenLabs)} style={{
                                width: 40, height: 22, borderRadius: 11, background: useElevenLabs ? 'var(--color-primary)' : 'var(--color-border)',
                                position: 'relative', border: 'none', cursor: 'pointer', transition: '0.3s', flexShrink: 0
                            }}>
                                <div style={{
                                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                                    position: 'absolute', top: 2, left: useElevenLabs ? 20 : 2, transition: '0.3s',
                                    boxShadow: 'var(--shadow-sm)'
                                }} />
                            </button>
                        </div>

                        {useElevenLabs ? (
                            <select value={elevenVoiceId} onChange={e => setElevenVoiceId(e.target.value)}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: 12 }}>
                                {elevenVoices.length > 0 ? elevenVoices.map((v, i) => <option key={i} value={v.voice_id}>{v.name}</option>) : <option value="">Chargement...</option>}
                            </select>
                        ) : (
                            <select value={ttsVoiceIdx} onChange={e => setTtsVoiceIdx(Number(e.target.value))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: 12 }}>
                                {ttsVoices.length > 0 ? ttsVoices.map((v, i) => <option key={i} value={i}>{v.name} ({v.lang})</option>) : <option value="">Aucune voix</option>}
                            </select>
                        )}
                    </div>

                    {/* Sentence list (jump to) */}
                    {ttsSentences.length > 1 && (
                        <div>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' }}>Paragraphes ({ttsSentences.length})</span>
                            <div style={{ maxHeight: 120, overflowY: 'auto', borderRadius: 10, background: 'var(--color-bg-light)' }}>
                                {ttsSentences.map((s, i) => (
                                    <button key={i} onClick={() => ttsJumpToSentence(i)} style={{
                                        display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', textAlign: 'left',
                                        padding: '8px 10px', borderBottom: '1px solid var(--color-border)',
                                        background: i === ttsSentenceIdx ? 'var(--color-primary-light)' : 'transparent',
                                        transition: 'background 0.2s ease'
                                    }}>
                                        <span style={{ fontSize: 10, color: i === ttsSentenceIdx ? 'var(--color-primary-text)' : 'var(--color-text-muted)', fontWeight: 700, minWidth: 20, flexShrink: 0 }}>{i + 1}</span>
                                        <span style={{ fontSize: 11, color: i === ttsSentenceIdx ? 'var(--color-text)' : 'var(--color-text-muted)', lineHeight: 1.4 }}>{s.substring(0, 80)}{s.length > 80 ? '…' : ''}</span>
                                        {i === ttsSentenceIdx && ttsPlaying && <VolumeHigh size={14} color="var(--color-primary-text)" variant="Bold" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Bottom Bar ── */}
            <div className={`reader-bottom-bar ${!showToolbar ? 'hidden' : ''}`} style={{
                flexShrink: 0, zIndex: 100, justifyContent: 'center', gap: 48, padding: '8px 8px 12px',
                borderTop: '1px solid var(--color-border)'
            }}>
                <button onClick={(e) => { e.stopPropagation(); setShowAudioPanel(false); setShowAnnotatePanel(p => !p); }}
                    aria-label="Annoter"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 'none', color: showAnnotatePanel ? 'var(--color-primary-text)' : 'inherit' }}
                >
                    <Edit2 size={22} color="currentColor" variant="Linear" />
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Annoter</span>
                </button>

                <button onClick={(e) => { e.stopPropagation(); setShowAnnotatePanel(false); setShowAudioPanel(p => !p); }}
                    aria-label="Audio"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 'none', color: showAudioPanel ? 'var(--color-primary-text)' : (ttsPlaying ? '#16A34A' : 'inherit') }}
                >
                    {ttsPlaying ? <VolumeHigh size={22} color="#16A34A" variant="Bold" /> : <Headphones size={22} color="currentColor" variant="Linear" />}
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Audio</span>
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
