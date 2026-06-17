import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
    isBookOffline, getReadingProgress, getStorageUsage, formatSize,
    saveBookOffline, saveCoverOffline, removeOfflineBook,
    getAllOfflineBooks, preloadCoverUrls,
    getOfflineBooksSync, getProgressMapSync, getStorageUsageSync
} from '../lib/offlineStore';

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

export default function Home() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // ── INSTANT first render from localStorage (synchronous, <5ms) ──
    const isOfflineNow = !navigator.onLine;
    const syncBooks = isOfflineNow ? getOfflineBooksSync() : [];
    const syncProgress = isOfflineNow ? getProgressMapSync() : {};
    const syncStorage = isOfflineNow ? getStorageUsageSync() : { totalBytes: 0, bookCount: 0 };
    const syncStatuses = isOfflineNow ? Object.fromEntries(syncBooks.map(b => [b.id, true])) : {};

    const [books, setBooks] = useState(isOfflineNow ? syncBooks : []);
    const [loading, setLoading] = useState(!isOfflineNow); // Already loaded if offline + sync data
    const [offlineStatus, setOfflineStatus] = useState(syncStatuses);
    const [progressMap, setProgressMap] = useState(syncProgress);
    const [tab, setTab] = useState('all');
    const [storage, setStorage] = useState(syncStorage);
    const [downloading, setDownloading] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [coverUrls, setCoverUrls] = useState({});
    const isOfflineMode = useRef(!navigator.onLine);

    // Track online/offline changes
    useEffect(() => {
        const goOnline = () => { isOfflineMode.current = false; };
        const goOffline = () => { isOfflineMode.current = true; };
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    const refreshOfflineStatus = useCallback(async (bookList) => {
        const statuses = {};
        const progresses = {};
        
        await Promise.all(bookList.map(async (b) => {
            statuses[b.id] = await isBookOffline(b.id);
            const p = await getReadingProgress(b.id);
            if (p) progresses[b.id] = p;
        }));
        
        setOfflineStatus(statuses);
        setProgressMap(progresses);
        setStorage(await getStorageUsage());
    }, []);

    useEffect(() => {
        // ── Offline mode: covers are the only async part ──
        if (!navigator.onLine) {
            // Books are already displayed from syncBooks — just load covers in background
            (async () => {
                try {
                    const bookIds = syncBooks.map(b => b.id);
                    const urls = await preloadCoverUrls(bookIds);
                    setCoverUrls(urls);
                } catch (err) { console.error(err); }
            })();
            return;
        }

        // ── Online mode ──
        if (authLoading) return;
        if (!user) { navigate('/login'); return; }
        (async () => {
            try {
                const { data: accessRows } = await supabase
                    .from('user_book_access')
                    .select('book_id, granted_at, books:book_id(id, title, author, cover_url, file_url)')
                    .eq('user_id', user.id).order('granted_at', { ascending: false });

                let bookList = [];
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
                setBooks(bookList);
                await refreshOfflineStatus(bookList);

                // Pre-load cached cover URLs
                const offlineIds = bookList.map(b => b.id);
                const urls = await preloadCoverUrls(offlineIds);
                setCoverUrls(urls);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        })();
    }, [user, authLoading, navigate, refreshOfflineStatus]);

    const handleDownload = async (book) => {
        setDownloading(book.id);
        setDownloadProgress(0);
        try {
            const filePath = book.file_url || `pdfs/${book.id}.pdf`;
            let blob = null;

            setDownloadProgress(15);
            const { data, error } = await supabase.storage.from('books').download(filePath);
            if (!error && data) {
                blob = data;
            } else {
                setDownloadProgress(30);
                const { data: signedData, error: signedErr } = await supabase.storage.from('books').createSignedUrl(filePath, 3600);
                if (!signedErr && signedData?.signedUrl) {
                    const response = await fetch(signedData.signedUrl);
                    if (response.ok) {
                        blob = await response.blob();
                    }
                }
            }

            if (!blob) throw new Error('PDF non disponible');

            setDownloadProgress(70);
            await saveBookOffline(book.id, blob, { title: book.title, author: book.author, cover_url: book.cover_url });

            setDownloadProgress(85);
            if (book.cover_url) {
                await saveCoverOffline(book.id, book.cover_url);
            }

            setDownloadProgress(100);
            await refreshOfflineStatus(books);

            const urls = await preloadCoverUrls(books.map(b => b.id));
            setCoverUrls(urls);
        } catch (err) {
            console.error('Download failed:', err);
            alert("Le fichier PDF n'est pas disponible. Veuillez réessayer plus tard.");
        } finally {
            setTimeout(() => { setDownloading(null); setDownloadProgress(0); }, 500);
        }
    };

    const handleRemove = async (bookId) => {
        if (!confirm('Supprimer ce livre du stockage hors-ligne ?')) return;
        await removeOfflineBook(bookId);
        // Remove from local state immediately
        setBooks(prev => prev.filter(b => b.id !== bookId));
        setOfflineStatus(prev => { const n = { ...prev }; delete n[bookId]; return n; });
        setCoverUrls(prev => { const n = { ...prev }; delete n[bookId]; return n; });
        setStorage(getStorageUsageSync());
    };

    // Resolve cover image
    const getCoverSrc = (book) => {
        if (coverUrls[book.id]) return coverUrls[book.id];
        if (!navigator.onLine) return null; // Don't try network URLs when offline
        return book.cover_url;
    };

    const filteredBooks = books.filter(b => {
        const matchesTab = tab === 'all' || (tab === 'offline' && offlineStatus[b.id]);
        const matchesSearch = searchQuery.trim() === '' || 
            b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (b.author || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch;
    });

    if (authLoading || loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><div className="spinner" /></div>
    );

    const storageQuota = 100 * 1024 * 1024;
    const storagePct = Math.min(Math.round((storage.totalBytes / storageQuota) * 100), 100);

    return (
        <div style={{ paddingBottom: 40 }}>
            {/* Hero Dashboard */}
            <div className="library-hero" style={{ padding: '24px 0 20px', borderRadius: 16, margin: '12px var(--space-4) 0', background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="container">
                    <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, background: 'linear-gradient(90deg, #FFD700, #FFA000)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Ma Bibliothèque</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 12, margin: '4px 0 0' }}>Votre espace de lecture personnel et hors-ligne</p>
                    
                    <div className="library-stats-container">
                        <div className="library-stat-card">
                            <span className="library-stat-card-label" style={{ color: 'rgba(255,255,255,0.6)' }}>TOTAL LIVRES</span>
                            <span className="library-stat-card-value" style={{ color: '#fff' }}>{books.length}</span>
                        </div>
                        <div className="library-stat-card">
                            <span className="library-stat-card-label" style={{ color: 'rgba(255,255,255,0.6)' }}>HORS-LIGNE</span>
                            <span className="library-stat-card-value" style={{ color: '#fff' }}>{Object.values(offlineStatus).filter(Boolean).length}</span>
                        </div>
                        <div className="library-stat-card" style={{ gridColumn: 'span 2' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="library-stat-card-label" style={{ color: 'rgba(255,255,255,0.6)' }}>STOCKAGE DISQUE</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)' }}>{storagePct}%</span>
                            </div>
                            <span className="library-stat-card-value" style={{ fontSize: 13, marginTop: 2, color: '#fff' }}>
                                {formatSize(storage.totalBytes)} <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/ 100 Mo</span>
                            </span>
                            <div className="library-storage-track">
                                <div className="library-storage-bar" style={{ width: `${storagePct}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls: Tabs & Search */}
            <div className="container" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="library-tabs" style={{ padding: '4px 0', marginBottom: 0 }}>
                        <button className={`library-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')} style={{ fontSize: 12 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 4, verticalAlign: 'middle' }}>library_books</span>
                            Tous ({books.length})
                        </button>
                        <button className={`library-tab ${tab === 'offline' ? 'active' : ''}`} onClick={() => setTab('offline')} style={{ fontSize: 12 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 4, verticalAlign: 'middle' }}>download_done</span>
                            Hors-ligne ({Object.values(offlineStatus).filter(Boolean).length})
                        </button>
                    </div>

                    <div className="library-search-wrap">
                        <span className="material-symbols-outlined">search</span>
                        <input 
                            type="text" 
                            placeholder="Rechercher par titre ou auteur..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <span 
                                className="material-symbols-outlined" 
                                style={{ cursor: 'pointer', fontSize: 16 }}
                                onClick={() => setSearchQuery('')}
                            >
                                close
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="container" style={{ marginTop: 12 }}>
                {filteredBooks.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 44, color: 'var(--color-text-muted)', opacity: 0.3 }}>
                            {searchQuery ? 'search_off' : tab === 'offline' ? 'cloud_off' : 'library_books'}
                        </span>
                        <h3 style={{ fontWeight: 700, marginTop: 12, fontSize: 14, margin: '8px 0 4px' }}>
                            {searchQuery ? 'Aucun résultat' : tab === 'offline' ? 'Aucun livre hors-ligne' : 'Bibliothèque vide'}
                        </h3>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, margin: 0 }}>
                            {searchQuery ? 'Essayez avec un autre mot-clé.' : tab === 'offline' ? 'Téléchargez des livres pour les lire sans connexion.' : 'Achetez des livres sur BoomBooks.'}
                        </p>
                    </div>
                ) : (
                    <div className="book-grid">
                        {filteredBooks.map(b => {
                            const isOffline = offlineStatus[b.id];
                            const progress = progressMap[b.id];
                            const pct = progress ? Math.round((progress.currentPage / progress.totalPages) * 100) : 0;
                            const isDownloading = downloading === b.id;
                            const coverSrc = getCoverSrc(b);

                            return (
                                <div key={b.id} className="book-card" onClick={() => navigate(`/read/${b.id}`)}>
                                    <div className="book-cover-wrap" style={{ background: getBookGradient(b.id) }}>
                                        {coverSrc && <img src={coverSrc} alt={b.title} loading="lazy" />}
                                        
                                        {!isDownloading && (
                                            <div className="book-action-overlay">
                                                {isOffline ? (
                                                    <>
                                                        <span className="book-badge-icon" style={{ background: 'rgba(22,163,74,0.95)', borderColor: '#22c55e' }} title="Disponible hors-ligne">
                                                            <span className="material-symbols-outlined" style={{ fontSize: 11, fontWeight: 'bold' }}>done</span>
                                                        </span>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleRemove(b.id); }}
                                                            className="book-badge-icon delete-badge" 
                                                            title="Supprimer du stockage"
                                                            style={{ border: 'none', cursor: 'pointer' }}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>delete</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(b); }}
                                                        className="book-badge-icon" 
                                                        title="Télécharger pour lire hors-ligne"
                                                        style={{ border: 'none', cursor: 'pointer' }}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>download</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {isDownloading && (
                                            <div className="book-downloading-ring">
                                                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, margin: 0 }} />
                                                <span>{downloadProgress}%</span>
                                            </div>
                                        )}

                                        {progress && pct > 0 && (
                                            <div className="book-progress-bar">
                                                <div className="book-progress-fill" style={{ width: `${pct}%` }} />
                                            </div>
                                        )}
                                    </div>
                                    
                                    <h4 className="book-title line-clamp-2" title={b.title}>{b.title}</h4>
                                    <p className="book-author line-clamp-1">{b.author || 'Auteur inconnu'}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
