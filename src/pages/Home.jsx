import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { getAllOfflineBooks, getReadingProgress, preloadCoverUrls, getOfflineBooksSync, getProgressMapSync } from '../lib/offlineStore';
import { InstallButton } from '../components/InstallPrompt';

export default function Home() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isOffline = !navigator.onLine;

    // ── INSTANT first render from localStorage when offline (<5ms) ──
    const syncBooks = isOffline ? getOfflineBooksSync() : [];
    const syncProgress = isOffline ? getProgressMapSync() : {};

    // Compute last read from sync data instantly
    const computeLastRead = (books, progressMap) => {
        let latest = null;
        let latestId = null;
        for (const b of books) {
            const p = progressMap[b.id];
            if (p && p.lastReadAt && (!latest || p.lastReadAt > latest.lastReadAt)) {
                latest = p;
                latestId = b.id;
            }
        }
        if (latestId && latest) {
            const book = books.find(b => b.id === latestId);
            if (book) {
                return {
                    ...book,
                    currentPage: latest.currentPage,
                    totalPages: latest.totalPages,
                    pct: Math.round((latest.currentPage / latest.totalPages) * 100)
                };
            }
        }
        return null;
    };

    const [lastRead, setLastRead] = useState(isOffline ? computeLastRead(syncBooks, syncProgress) : null);
    const [myBooks, setMyBooks] = useState([]);
    const [offlineBooks, setOfflineBooks] = useState(syncBooks);
    const [loading, setLoading] = useState(!isOffline); // Already rendered if offline
    const [coverUrls, setCoverUrls] = useState({});

    // Load data
    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            let bookList = [];

            // ── Offline: covers are the only async part ──
            if (!navigator.onLine) {
                // Books already displayed from syncBooks, just load covers
                const urls = await preloadCoverUrls(syncBooks.map(b => b.id));
                setCoverUrls(urls);

                // Optionally update lastRead cover from cached URL
                if (lastRead && urls[lastRead.id]) {
                    setLastRead(prev => prev ? { ...prev, _coverUrl: urls[prev.id] } : prev);
                }

                setLoading(false);
                return;
            }

            // ── Online mode ──
            const { data: accessRows } = await supabase
                .from('user_book_access')
                .select('book_id, granted_at, books:book_id(id, title, author, cover_url, file_url)')
                .eq('user_id', user.id)
                .order('granted_at', { ascending: false });

            if (accessRows?.length) {
                bookList = accessRows.filter(r => r.books).map(r => ({ ...r.books, granted_at: r.granted_at }));
            } else {
                const { data: orders } = await supabase.from('orders')
                    .select('id, order_items(book_id, books(id, title, author, cover_url, file_url))')
                    .eq('user_id', user.id).eq('status', 'paid');
                const seen = new Set();
                (orders || []).forEach(o => o.order_items?.forEach(oi => {
                    if (oi.books && !seen.has(oi.books.id)) { seen.add(oi.books.id); bookList.push(oi.books); }
                }));
            }
            setMyBooks(bookList);

            const offBooks = await getAllOfflineBooks();
            setOfflineBooks(offBooks);

            const allBookIds = [...new Set([...bookList.map(b => b.id), ...offBooks.map(b => b.id)])];
            const urls = await preloadCoverUrls(allBookIds);
            setCoverUrls(urls);

            // Find the last read book
            let latestProgress = null;
            let latestBookId = null;
            for (const b of [...bookList, ...offBooks]) {
                const progress = await getReadingProgress(b.id);
                if (progress && progress.lastReadAt) {
                    if (!latestProgress || progress.lastReadAt > latestProgress.lastReadAt) {
                        latestProgress = progress;
                        latestBookId = b.id;
                    }
                }
            }

            if (latestBookId && latestProgress) {
                const book = bookList.find(b => b.id === latestBookId) || offBooks.find(b => b.id === latestBookId);
                if (book) {
                    setLastRead({
                        ...book,
                        currentPage: latestProgress.currentPage,
                        totalPages: latestProgress.totalPages,
                        pct: Math.round((latestProgress.currentPage / latestProgress.totalPages) * 100)
                    });
                }
            }
        } catch (err) {
            console.error('Home load error:', err);
            try {
                const offBooks = await getAllOfflineBooks();
                setOfflineBooks(offBooks);
                const urls = await preloadCoverUrls(offBooks.map(b => b.id));
                setCoverUrls(urls);
            } catch { /* ignore */ }
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        // In offline mode, sync data is already displayed — only load covers async
        if (isOffline) {
            (async () => {
                try {
                    const urls = await preloadCoverUrls(syncBooks.map(b => b.id));
                    setCoverUrls(urls);
                } catch { /* ignore */ }
            })();
            return;
        }
        const timer = setTimeout(() => { loadData(); }, 0);
        return () => clearTimeout(timer);
    }, [loadData]);

    function getBookGradient(id) {
        if (!id) return 'linear-gradient(135deg, #667eea, #764ba2)';
        const palettes = [
            ['#667eea','#764ba2'], ['#f093fb','#f5576c'], ['#4facfe','#00f2fe'],
            ['#43e97b','#38f9d7'], ['#fa709a','#fee140'], ['#a18cd1','#fbc2eb'],
            ['#fccb90','#d57eeb'], ['#e0c3fc','#8ec5fc'], ['#f5576c','#ff9a9e']
        ];
        const hash = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const [a, b] = palettes[hash % palettes.length];
        return `linear-gradient(135deg, ${a}, ${b})`;
    }

    const getCoverSrc = (book) => {
        if (coverUrls[book.id]) return coverUrls[book.id];
        if (book._coverUrl) return book._coverUrl;
        if (!navigator.onLine) return null;
        return book.cover_url;
    };

    return (
        <div>

            {/* Offline Banner */}
            {isOffline && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 16px', marginBottom: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 152, 0, 0.1)',
                    border: '1px solid rgba(255, 152, 0, 0.25)',
                    fontSize: 'var(--text-sm)', color: '#FFA726'
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>wifi_off</span>
                    <span>Mode hors-ligne — Vos livres téléchargés sont disponibles</span>
                </div>
            )}

            {/* Install App card */}
            {!isOffline && <InstallButton style={{ marginBottom: 'var(--space-6)' }} />}

            {/* Continue Reading */}
            {lastRead && (
                <>
                    <div className="section-header">
                        <h2 className="section-title">Continuer la lecture</h2>
                    </div>
                    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-8)', cursor: 'pointer' }} onClick={() => navigate(`/read/${lastRead.id}`)}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-6) 0', background: 'var(--color-bg-dark)' }}>
                            <div style={{ width: 120, height: 180, borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', background: getBookGradient(lastRead.id) }}>
                                {getCoverSrc(lastRead) && <img src={getCoverSrc(lastRead)} alt={lastRead.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            </div>
                        </div>
                        <div style={{ padding: 'var(--space-4)' }}>
                            <p style={{ color: 'var(--color-primary)', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                                Page {lastRead.currentPage} / {lastRead.totalPages}
                            </p>
                            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 4 }} className="line-clamp-2">{lastRead.title}</h3>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>{lastRead.author || 'Auteur inconnu'}</p>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                                <span>{lastRead.pct}% terminé</span>
                            </div>
                            <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${lastRead.pct}%`, height: '100%', background: 'var(--color-primary)' }}></div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* My Books (online only) */}
            {myBooks.length > 0 && (
                <>
                    <div className="section-header">
                        <h2 className="section-title">Mes Livres</h2>
                        <button className="section-link" onClick={() => navigate('/library')}>
                            Tout voir <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                        </button>
                    </div>
                    <div className="horizontal-scroll" style={{ marginBottom: 'var(--space-8)' }}>
                        {myBooks.slice(0, 8).map((book) => (
                            <div key={book.id} style={{ minWidth: 140, width: 140, cursor: 'pointer' }} onClick={() => navigate(`/read/${book.id}`)}>
                                <div style={{ width: '100%', height: 200, borderRadius: 'var(--radius-md)', marginBottom: 12, overflow: 'hidden', background: getBookGradient(book.id) }}>
                                    {getCoverSrc(book) && <img src={getCoverSrc(book)} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                </div>
                                <h4 className="line-clamp-2" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{book.title}</h4>
                                <p className="line-clamp-1" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{book.author || 'Auteur inconnu'}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Offline Books */}
            {offlineBooks.length > 0 && (
                <>
                    <div className="section-header">
                        <h2 className="section-title">📥 Disponibles hors-ligne</h2>
                    </div>
                    <div className="horizontal-scroll" style={{ marginBottom: 'var(--space-8)' }}>
                        {offlineBooks.map((book) => {
                            const coverSrc = getCoverSrc(book);
                            return (
                                <div key={book.id} style={{ minWidth: 140, width: 140, cursor: 'pointer' }} onClick={() => navigate(`/read/${book.id}`)}>
                                    <div style={{ width: '100%', height: 200, borderRadius: 'var(--radius-md)', marginBottom: 12, overflow: 'hidden', background: getBookGradient(book.id), position: 'relative' }}>
                                        {coverSrc && <img src={coverSrc} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(22,163,74,0.9)', color: '#fff', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                                        </div>
                                    </div>
                                    <h4 className="line-clamp-2" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{book.title}</h4>
                                    <p className="line-clamp-1" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{book.author || 'Auteur inconnu'}</p>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Empty state */}
            {!loading && myBooks.length === 0 && offlineBooks.length === 0 && (
                <div className="empty-state" style={{ paddingTop: 60 }}>
                    <span className="material-symbols-outlined empty-state-icon" style={{ color: 'var(--color-primary)', fontSize: 56 }}>library_books</span>
                    <h3 style={{ fontWeight: 700, marginTop: 12 }}>
                        {isOffline ? 'Aucun livre hors-ligne' : 'Bienvenue sur BRead !'}
                    </h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 8, maxWidth: 280, lineHeight: 1.6, margin: '8px auto 0' }}>
                        {isOffline 
                            ? 'Connectez-vous à Internet et téléchargez des livres pour les lire hors-ligne.' 
                            : <>Achetez des livres sur <strong>BoomBooks.shop</strong> puis revenez ici pour les lire hors-ligne.</>
                        }
                    </p>
                    {!isOffline && (
                        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => window.open('https://boombooks.shop', '_blank')}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 6 }}>open_in_new</span>
                            Découvrir BoomBooks
                        </button>
                    )}
                </div>
            )}

            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
                    <div className="spinner" />
                </div>
            )}
        </div>
    );
}
