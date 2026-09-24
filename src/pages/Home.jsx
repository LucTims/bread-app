import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchNormal1 } from 'iconsax-react';
import { useAuth } from '../lib/AuthContext';
import { supabase, getFreeBooks } from '../lib/supabase';
import { getAllOfflineBooks, getReadingProgress, preloadCoverUrls, getOfflineBooksSync, getProgressMapSync } from '../lib/offlineStore';
import { getDailyFallbackQuote } from '../lib/quotes';
import useOnlineStatus from '../lib/useOnlineStatus';

function timeGreeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Bonjour';
    if (h >= 12 && h < 18) return 'Bon après-midi';
    if (h >= 18 && h < 22) return 'Bonsoir';
    return 'Bonne nuit';
}

export default function Home() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isOffline } = useOnlineStatus();
    const [query, setQuery] = useState('');

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
    const [quoteOfDay, setQuoteOfDay] = useState(getDailyFallbackQuote());

    // Load data
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            let bookList = [];

            // ── Offline: covers are the only async part ──
            if (isOffline) {
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
            if (user) {
                const { data: accessRows } = await supabase
                    .from('user_book_access')
                    .select('book_id, granted_at, books:book_id(id, title, author, cover_url, file_url)')
                    .eq('user_id', user.id)
                    .order('granted_at', { ascending: false });

                if (accessRows?.length) {
                    bookList = accessRows.filter(r => r.books).map(r => ({ ...r.books, granted_at: r.granted_at }));
                }

                const { data: orders } = await supabase.from('orders')
                    .select('id, order_items(book_id, books(id, title, author, cover_url, file_url))')
                    .eq('user_id', user.id).eq('status', 'paid');
                const seen = new Set(bookList.map(b => b.id));
                (orders || []).forEach(o => o.order_items?.forEach(oi => {
                    if (oi.books && !seen.has(oi.books.id)) { seen.add(oi.books.id); bookList.push(oi.books); }
                }));

                const freeBooks = await getFreeBooks();
                freeBooks.forEach(fb => {
                    if (!seen.has(fb.id)) { seen.add(fb.id); bookList.push({...fb, is_free_offer: true}); }
                });

                setMyBooks(bookList);
            }

            const offBooks = await getAllOfflineBooks();
            setOfflineBooks(offBooks);

            try {
                const tzOffset = (new Date()).getTimezoneOffset() * 60000;
                const todayStr = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
                const { data: quoteData } = await supabase.from('daily_quotes').select('*').eq('date', todayStr).single();
                if (quoteData) {
                    setQuoteOfDay({ text: quoteData.quote_text, author: quoteData.quote_author });
                }
            } catch (e) { /* ignore error if no custom quote */ }

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
    }, [user, isOffline]);

    useEffect(() => {
        // In offline mode, sync data is already displayed — update state and load covers async
        if (isOffline) {
            (async () => {
                try {
                    const booksToLoad = getOfflineBooksSync();
                    setOfflineBooks(booksToLoad);
                    const progMap = getProgressMapSync();
                    setLastRead(computeLastRead(booksToLoad, progMap));
                    setLoading(false);
                    const urls = await preloadCoverUrls(booksToLoad.map(b => b.id));
                    setCoverUrls(urls);
                } catch { /* ignore */ }
            })();
            return;
        }
        const timer = setTimeout(() => { loadData(); }, 0);
        return () => clearTimeout(timer);
    }, [loadData, isOffline]);

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
        return book.cover_url;
    };

    const firstName = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '').split(' ')[0];

    // Message d'activité — dépend de ce que fait vraiment le lecteur en ce moment
    const totalBooks = myBooks.length + offlineBooks.length;
    const activityMessage = lastRead
        ? `Reprenez "${lastRead.title}" · page ${lastRead.currentPage}/${lastRead.totalPages}`
        : totalBooks > 0
            ? `${totalBooks} livre${totalBooks > 1 ? 's' : ''} dans votre bibliothèque`
            : 'Importez votre premier livre pour commencer';

    // Recherche — sur tous les livres synchronisés (achetés + hors-ligne)
    const allBooks = useMemo(() => {
        const map = new Map();
        [...myBooks, ...offlineBooks].forEach(b => { if (!map.has(b.id)) map.set(b.id, b); });
        return [...map.values()];
    }, [myBooks, offlineBooks]);

    const searchResults = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return allBooks.filter(b =>
            b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q)
        ).slice(0, 20);
    }, [query, allBooks]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - var(--bottom-nav-height) - var(--space-8))' }}>
            {/* Salutation en haut à gauche */}
            <div style={{ marginTop: 'var(--space-6)' }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>{timeGreeting()}, </span>
                    {firstName || 'Lecteur'}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>{activityMessage}</p>
            </div>

            {/* Recherche + citation + logo — centrés dans l'espace restant de l'écran */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--space-5)', paddingBottom: '40px' }}>
                
                {/* Logo de l'application centré au-dessus de la barre de recherche */}
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, color: 'var(--color-text)', letterSpacing: '-1.5px' }}>
                        Bread
                    </h1>
                </div>

                {/* Barre de recherche — sur tous les livres synchronisés */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center',
                        border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 16px'
                    }}>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Rechercher un livre, un auteur..."
                            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text)' }}
                        />
                    </div>
                    <div style={{
                        width: 44, height: 44, borderRadius: 8, background: 'var(--color-primary)', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <SearchNormal1 size={20} color="#000" variant="Linear" />
                    </div>
                </div>

                {/* Résultats de recherche */}
                {query.trim() ? (
                    <div>
                        {searchResults.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Aucun résultat pour "{query}".</p>
                        ) : (
                            searchResults.map(book => (
                                <div key={book.id} onClick={() => navigate(`/read/${book.id}`)} style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                                    borderBottom: '1px solid var(--color-border)', cursor: 'pointer'
                                }}>
                                    <div style={{ width: 40, height: 56, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: getBookGradient(book.id) }}>
                                        {getCoverSrc(book) && <img src={getCoverSrc(book)} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <h4 className="line-clamp-1" style={{ fontSize: 14, fontWeight: 600 }}>{book.title}</h4>
                                        <p className="line-clamp-1" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{book.author || 'Auteur inconnu'}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="card" style={{ padding: 'var(--space-5)', borderRadius: 8 }}>
                        <p style={{ fontSize: 13.5, color: 'var(--color-text)', fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>
                            "{quoteOfDay.text}"
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '8px 0 0', textAlign: 'right' }}>
                            — {quoteOfDay.author}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
