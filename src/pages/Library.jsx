import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { isBookOffline, getReadingProgress, getStorageUsage, formatSize, saveBookOffline, removeOfflineBook } from '../lib/offlineStore';

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
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [offlineStatus, setOfflineStatus] = useState({});
    const [progressMap, setProgressMap] = useState({});
    const [tab, setTab] = useState('all');
    const [storage, setStorage] = useState({ totalBytes: 0, bookCount: 0 });
    const [downloading, setDownloading] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);

    const refreshOfflineStatus = useCallback(async (bookList) => {
        const statuses = {};
        const progresses = {};
        for (const b of bookList) {
            statuses[b.id] = await isBookOffline(b.id);
            const p = await getReadingProgress(b.id);
            if (p) progresses[b.id] = p;
        }
        setOfflineStatus(statuses);
        setProgressMap(progresses);
        setStorage(await getStorageUsage());
    }, []);

    useEffect(() => {
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
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        })();
    }, [user, authLoading, navigate, refreshOfflineStatus]);

    const handleDownload = async (book) => {
        setDownloading(book.id);
        setDownloadProgress(0);
        try {
            // Télécharger le PDF depuis Supabase Storage
            const filePath = book.file_url || `pdfs/${book.id}.pdf`;
            const { data, error } = await supabase.storage.from('books').download(filePath);
            if (error) throw error;

            setDownloadProgress(80);
            await saveBookOffline(book.id, data, { title: book.title, author: book.author, cover_url: book.cover_url });
            setDownloadProgress(100);

            await refreshOfflineStatus(books);
        } catch (err) {
            console.error('Download failed:', err);
            alert('Erreur lors du téléchargement. Vérifiez votre connexion.');
        } finally {
            setTimeout(() => { setDownloading(null); setDownloadProgress(0); }, 500);
        }
    };

    const handleRemove = async (bookId) => {
        if (!confirm('Supprimer ce livre du stockage hors-ligne ?')) return;
        await removeOfflineBook(bookId);
        await refreshOfflineStatus(books);
    };

    const filteredBooks = tab === 'offline' ? books.filter(b => offlineStatus[b.id]) : books;

    if (authLoading || loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><div className="spinner" /></div>
    );

    return (
        <div>
            {/* Hero */}
            <div className="library-hero">
                <div className="container">
                    <h1>Ma Bibliothèque</h1>
                    <p>{books.length} livre{books.length !== 1 ? 's' : ''} • {storage.bookCount} hors-ligne ({formatSize(storage.totalBytes)})</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="container">
                <div className="library-tabs">
                    <button className={`library-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>library_books</span>
                        Tous ({books.length})
                    </button>
                    <button className={`library-tab ${tab === 'offline' ? 'active' : ''}`} onClick={() => setTab('offline')}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>download_done</span>
                        Hors-ligne ({Object.values(offlineStatus).filter(Boolean).length})
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="container">
                {filteredBooks.length === 0 ? (
                    <div className="empty-state" style={{ paddingTop: 60 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 56, color: 'var(--color-text-muted)', opacity: 0.4 }}>
                            {tab === 'offline' ? 'cloud_off' : 'library_books'}
                        </span>
                        <h3 style={{ fontWeight: 700, marginTop: 8 }}>
                            {tab === 'offline' ? 'Aucun livre hors-ligne' : 'Bibliothèque vide'}
                        </h3>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                            {tab === 'offline' ? 'Téléchargez des livres pour les lire sans connexion.' : 'Achetez des livres sur BoomBooks.'}
                        </p>
                    </div>
                ) : (
                    <div className="book-grid">
                        {filteredBooks.map(b => {
                            const isOffline = offlineStatus[b.id];
                            const progress = progressMap[b.id];
                            const pct = progress ? Math.round((progress.currentPage / progress.totalPages) * 100) : 0;
                            const isDownloading = downloading === b.id;

                            return (
                                <div key={b.id} className="book-card" onClick={() => isOffline ? navigate(`/reader/${b.id}`) : null}>
                                    <div className="book-cover-wrap" style={{ background: getBookGradient(b.id) }}>
                                        {b.cover_url && <img src={b.cover_url} alt={b.title} />}
                                        {isOffline && (
                                            <div className="book-offline-badge">
                                                <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                            </div>
                                        )}
                                        {progress && pct > 0 && (
                                            <div className="book-progress-bar">
                                                <div className="book-progress-fill" style={{ width: `${pct}%` }} />
                                            </div>
                                        )}
                                    </div>
                                    <h4 className="book-title line-clamp-2">{b.title}</h4>
                                    <p className="book-author line-clamp-1">{b.author || 'Auteur inconnu'}</p>

                                    {isDownloading ? (
                                        <div style={{ marginTop: 8 }}>
                                            <div className="download-progress-track">
                                                <div className="download-progress-fill" style={{ width: `${downloadProgress}%` }} />
                                            </div>
                                        </div>
                                    ) : isOffline ? (
                                        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                                            <button onClick={(e) => { e.stopPropagation(); navigate(`/reader/${b.id}`); }} className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: 11 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>menu_book</span> Lire
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleRemove(b.id); }} className="btn btn-ghost btn-sm" style={{ padding: '6px 8px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={(e) => { e.stopPropagation(); handleDownload(b); }} className="btn btn-outline btn-sm btn-block" style={{ marginTop: 8, fontSize: 11 }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span> Télécharger
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
