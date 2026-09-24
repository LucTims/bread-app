import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft2, SearchNormal1, CloseCircle, SearchStatus, Book1, Trash, DocumentDownload, DocumentUpload, Edit2, More, ShoppingBag, ArrowRight, InfoCircle, Teacher } from 'iconsax-react';
import { supabase, getFreeBooks } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
    isBookOffline, getReadingProgress, getStorageUsage, formatSize,
    saveBookOffline, saveCoverOffline, removeOfflineBook, renameLocalBook,
    getAllOfflineBooks, preloadCoverUrls,
    getOfflineBooksSync, getProgressMapSync, getStorageUsageSync
} from '../lib/offlineStore';
import useOnlineStatus from '../lib/useOnlineStatus';
import { importFilesList } from '../lib/deviceFileHandler';

function getBookGradient(id) {
    if (!id) return 'linear-gradient(135deg, #667eea, #764ba2)';
    const palettes = [
        ['#667eea','#764ba2'], ['#f093fb','#f5576c'], ['#4facfe','#00f2fe'],
        ['#43e97b','#38f9d7'], ['#fa709a','#fee140'], ['#a18cd1','#fbc2eb'],
        ['#fccb90','#d57eeb'], ['#e0c3fc','#8ec5fc'], ['#f5576c','#ff9a9e']
    ];
    const hash = (id || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const [a, b] = palettes[hash % palettes.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
}

export default function Library() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { isOffline: isOfflineNow } = useOnlineStatus();
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);

    // ── INSTANT first render from localStorage (synchronous, <5ms) ──
    // Always seed from the local index, online or not — shows something real
    // immediately instead of a blank spinner, then loadLibraryData refines it.
    const syncBooks = getOfflineBooksSync();
    const syncProgress = getProgressMapSync();
    const syncStorage = getStorageUsageSync();
    const syncStatuses = Object.fromEntries(syncBooks.map(b => [b.id, true]));

    const [books, setBooks] = useState(syncBooks);
    const [loading, setLoading] = useState(false);
    const [offlineStatus, setOfflineStatus] = useState(syncStatuses);
    const [progressMap, setProgressMap] = useState(syncProgress);
    const [storage, setStorage] = useState(syncStorage);
    const [downloading, setDownloading] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [coverUrls, setCoverUrls] = useState({});
    const isOfflineMode = useRef(isOfflineNow);
    const [openMenuId, setOpenMenuId] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Track online/offline changes
    useEffect(() => {
        isOfflineMode.current = isOfflineNow;
    }, [isOfflineNow]);

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

    const loadLibraryData = useCallback(async () => {
        // ── Offline mode ──
        if (isOfflineNow) {
            const currentSyncBooks = getOfflineBooksSync();
            setBooks(currentSyncBooks);
            setOfflineStatus(Object.fromEntries(currentSyncBooks.map(b => [b.id, true])));
            setProgressMap(getProgressMapSync());
            setStorage(getStorageUsageSync());
            setLoading(false);
            try {
                const bookIds = currentSyncBooks.map(b => b.id);
                const urls = await preloadCoverUrls(bookIds);
                setCoverUrls(urls);
            } catch (err) { console.error(err); }
            return;
        }

        // ── Online mode (Hybrid: Guest + Auth) ──
        // No setLoading(true) here — we already show the locally-cached list
        // instantly; this just refines it in the background once it resolves.
        if (authLoading) return;
        try {
            let bookList = [];
            const seen = new Set();

            if (user) {
                const { data: accessRows } = await supabase
                    .from('user_book_access')
                    .select('book_id, granted_at, books:book_id(id, title, author, cover_url, file_url)')
                    .eq('user_id', user.id).order('granted_at', { ascending: false });

                if (accessRows?.length) {
                    accessRows.filter(r => r.books).forEach(r => {
                        seen.add(r.books.id);
                        bookList.push({ ...r.books, granted_at: r.granted_at, isBoomBooks: true });
                    });
                }
                
                const { data: orders } = await supabase.from('orders')
                    .select('id, order_items(book_id, books(id, title, author, cover_url, file_url))')
                    .eq('user_id', user.id).eq('status', 'paid');
                (orders || []).forEach(o => o.order_items?.forEach(oi => {
                    if (oi.books && !seen.has(oi.books.id)) {
                        seen.add(oi.books.id);
                        bookList.push({ ...oi.books, isBoomBooks: true });
                    }
                }));

                const freeBooks = await getFreeBooks();
                freeBooks.forEach(fb => {
                    if (!seen.has(fb.id)) {
                        seen.add(fb.id);
                        bookList.push({ ...fb, is_free_offer: true, isBoomBooks: true });
                    }
                });

                // Subscription catalog
                const { data: profile } = await supabase.from('profiles').select('subscription_plan, subscription_end_date').eq('id', user.id).single();
                if (profile?.subscription_plan && new Date(profile.subscription_end_date) > new Date()) {
                    const plan = profile.subscription_plan.toLowerCase();
                    if (plan.includes('batisseur') || plan.includes('discipline')) {
                        const { data: allBooks } = await supabase.from('books').select('id, title, author, cover_url, file_url, is_free');
                        if (allBooks) {
                            allBooks.forEach(b => {
                                if (!seen.has(b.id)) { 
                                    seen.add(b.id); 
                                    bookList.push({ ...b, is_subscription: true, isBoomBooks: true }); 
                                }
                            });
                        }
                    }
                }
            }

            // Toujours fusionner les livres locaux / offline
            const offBooks = await getAllOfflineBooks();
            offBooks.forEach(ob => {
                if (!seen.has(ob.id)) {
                    seen.add(ob.id);
                    bookList.push({ 
                        ...ob, 
                        isLocal: Boolean(ob.isLocal || String(ob.id).startsWith('local_')),
                        isBoomBooks: !Boolean(ob.isLocal || String(ob.id).startsWith('local_'))
                    });
                }
            });

            setBooks(bookList);
            await refreshOfflineStatus(bookList);

            const offlineIds = bookList.map(b => b.id);
            const urls = await preloadCoverUrls(offlineIds);
            setCoverUrls(urls);
        } catch (err) {
            console.error('Library load error:', err);
        } finally {
            setLoading(false);
        }
    }, [user, authLoading, isOfflineNow, refreshOfflineStatus]);

    useEffect(() => {
        loadLibraryData();
    }, [loadLibraryData]);

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
            await saveBookOffline(book.id, blob, { 
                title: book.title, 
                author: book.author, 
                cover_url: book.cover_url, 
                is_subscription: book.is_subscription 
            });

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

    const handleSyncBook = () => fileInputRef.current?.click();

    const handleRename = async (book) => {
        const newTitle = prompt('Renommer ce livre :', book.title);
        if (!newTitle || !newTitle.trim() || newTitle.trim() === book.title) return;
        await renameLocalBook(book.id, newTitle.trim());
        setBooks(prev => prev.map(b => b.id === book.id ? { ...b, title: newTitle.trim() } : b));
    };

    const handleDetails = (book, isLocalBook) => {
        const lines = [
            `Titre : ${book.title}`,
            `Auteur : ${book.author || 'Auteur inconnu'}`,
            `Source : ${isLocalBook ? 'Appareil' : 'BoomBooks'}`,
        ];
        if (isLocalBook && book.sizeBytes) lines.push(`Taille : ${formatSize(book.sizeBytes)}`);
        if (book.format) lines.push(`Format : ${book.format.toUpperCase()}`);
        alert(lines.join('\n'));
    };

    // Resolve cover image
    const getCoverSrc = (book) => {
        if (coverUrls[book.id]) return coverUrls[book.id];
        return book.cover_url;
    };

    const filteredBooks = books.filter(b => {
        const matchesSearch = searchQuery.trim() === '' ||
            b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (b.author || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    if (authLoading || loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><div className="spinner" /></div>
    );

    return (
        <div style={{ paddingBottom: 40 }}>
            {/* Input file caché pour import instantané style Phoenix */}
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept="application/pdf,application/epub+zip,.pdf,.epub" 
                multiple
                onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    setImporting(true);
                    try {
                        const newIds = await importFilesList(files);
                        if (newIds && newIds.length > 0) {
                            await loadLibraryData();
                        }
                    } catch (err) {
                        console.error('Erreur importation:', err);
                    } finally {
                        setImporting(false);
                        e.target.value = '';
                    }
                }}
            />

            {/* Section figée en haut */}
            <div style={{
                position: 'sticky',
                top: 'calc(-1 * var(--space-4))',
                background: 'var(--color-bg)',
                zIndex: 20,
                paddingTop: 'var(--space-4)',
                paddingBottom: '8px',
                margin: 'calc(-1 * var(--space-4)) calc(-1 * var(--space-5)) 0',
                paddingLeft: 'var(--space-5)',
                paddingRight: 'var(--space-5)'
            }}>
                {/* En-tête compact — flèche retour + titre */}
                <div className="container" style={{ marginTop: 2, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={() => navigate(-1)}
                        aria-label="Retour"
                        style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--color-bg-dark)', border: 'none', cursor: 'pointer'
                        }}
                    >
                        <ArrowLeft2 size={16} color="var(--color-text)" variant="Linear" />
                    </button>
                    <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Livres</h1>
                </div>

                {/* Barre de recherche — en haut, cohérente avec Home */}
                <div className="container" style={{ marginTop: 8, padding: '0 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                            border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 14px'
                        }}>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Rechercher par titre ou auteur..."
                                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text)' }}
                            />
                            {searchQuery && (
                                <span style={{ cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)' }} onClick={() => setSearchQuery('')}>
                                    <CloseCircle size={16} color="currentColor" variant="Linear" />
                                </span>
                            )}
                        </div>
                        <div style={{
                            width: 38, height: 38, borderRadius: 8, background: 'var(--color-primary)', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <SearchNormal1 size={18} color="#000" variant="Linear" />
                        </div>
                    </div>
                </div>

                {/* Passerelle BoomBooks si non connecté — bandeau fin, cohérent avec Home */}
                {!user && (
                    <div className="container" style={{ marginTop: 8, padding: '0 4px' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                            padding: '8px 4px', borderBottom: '1px solid var(--color-border)'
                        }}>
                            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                                Connectez-vous pour synchroniser vos achats BoomBooks
                            </p>
                            <button
                                onClick={() => navigate('/login')}
                                style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-text)', whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                                Connexion
                            </button>
                        </div>
                    </div>
                )}

                {/* Cadre promotionnel BoomBooks.shop */}
                <div className="container" style={{ marginTop: 8, padding: '0 4px' }}>
                    <div
                        onClick={() => window.open('https://boombooks.shop', '_blank')}
                        style={{
                            position: 'relative', overflow: 'hidden', cursor: 'pointer',
                            borderRadius: 'var(--radius-xl)', padding: 'var(--space-5) var(--space-4)',
                            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
                            minHeight: 108, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                        }}
                    >
                        <ShoppingBag size={64} color="rgba(0,0,0,0.12)" variant="Bold" style={{ position: 'absolute', right: -8, bottom: -12 }} />
                        <div style={{ position: 'relative', maxWidth: '75%' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#000', margin: 0, lineHeight: 1.3 }}>
                                Encore plus de livres vous attendent
                            </h3>
                            <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.65)', margin: '4px 0 0', lineHeight: 1.4 }}>
                                Découvrez tout le catalogue sur BoomBooks.shop et trouvez votre prochaine lecture.
                            </p>
                        </div>
                        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#000' }}>
                            Visiter BoomBooks.shop
                            <ArrowRight size={16} color="#000" variant="Linear" />
                        </span>
                    </div>
                </div>

                {/* Synchroniser un livre du téléphone */}
                <div className="container" style={{ marginTop: 8, padding: '0 4px' }}>
                    <button
                        onClick={handleSyncBook}
                        disabled={importing}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                            borderRadius: 14, border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                            cursor: 'pointer', textAlign: 'left'
                        }}
                    >
                        {importing
                            ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, margin: 0, flexShrink: 0 }} />
                            : <DocumentUpload size={20} color="var(--color-primary-text)" variant="Linear" style={{ flexShrink: 0 }} />
                        }
                        <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                            {importing ? 'Importation en cours...' : 'Synchroniser un livre du téléphone'}
                        </h4>
                    </button>
                </div>
            </div>

            {/* Liste des livres — marges latérales réduites pour coller aux bords de l'écran */}
            <div className="container" style={{ marginTop: 10, padding: '0 4px' }}>
                {filteredBooks.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', opacity: 0.3, marginBottom: 8 }}>
                            {searchQuery
                                ? <SearchStatus size={44} color="var(--color-text-muted)" variant="Linear" />
                                : <Book1 size={44} color="var(--color-text-muted)" variant="Linear" />
                            }
                        </div>
                        <h3 style={{ fontWeight: 700, marginTop: 12, fontSize: 14, margin: '8px 0 4px' }}>
                            {searchQuery ? 'Aucun résultat' : 'Bibliothèque vide'}
                        </h3>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, margin: 0 }}>
                            {searchQuery ? 'Essayez avec un autre mot-clé.' : 'Achetez des livres sur BoomBooks.'}
                        </p>
                    </div>
                ) : (
                    <div>
                        {filteredBooks.map(b => {
                            const isOffline = offlineStatus[b.id];
                            const progress = progressMap[b.id];
                            const pct = progress ? Math.round((progress.currentPage / progress.totalPages) * 100) : 0;
                            const isDownloading = downloading === b.id;
                            const coverSrc = getCoverSrc(b);
                            const isLocalBook = Boolean(b.isLocal || String(b.id).startsWith('local_'));

                            return (
                                <div
                                    key={b.id}
                                    onClick={() => navigate(`/read/${b.id}`)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ position: 'relative', width: 52, height: 72, borderRadius: 0, overflow: 'hidden', flexShrink: 0, background: getBookGradient(b.id) }}>
                                        {coverSrc && <img src={coverSrc} alt={b.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />}

                                        {isDownloading && (
                                            <div style={{
                                                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: '#fff'
                                            }}>
                                                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, margin: 0 }} />
                                                <span style={{ fontSize: 9, fontWeight: 700 }}>{downloadProgress}%</span>
                                            </div>
                                        )}

                                        {!isDownloading && progress && pct > 0 && (
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(0,0,0,0.35)' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)' }} />
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h4 className="line-clamp-1" title={b.title} style={{ fontSize: 14, fontWeight: 700, margin: '0 0 3px' }}>{b.title}</h4>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <span style={{
                                                fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                                                textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 0,
                                                background: isLocalBook ? 'var(--color-bg-dark)' : 'var(--color-primary-light)',
                                                color: isLocalBook ? 'var(--color-text-muted)' : 'var(--color-primary-text)'
                                            }}>
                                                {isLocalBook ? 'Appareil' : 'BoomBooks'}
                                            </span>
                                            <span className="line-clamp-1" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                                {b.author || 'Auteur inconnu'}
                                            </span>
                                        </div>
                                    </div>

                                    {!isDownloading && (
                                        <div style={{ position: 'relative', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => setOpenMenuId(openMenuId === b.id ? null : b.id)}
                                                aria-label="Plus d'options"
                                                style={{
                                                    width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: 'transparent', border: 'none', cursor: 'pointer'
                                                }}
                                            >
                                                <More size={18} color="#000" variant="Outline" style={{ transform: 'rotate(90deg)' }} />
                                            </button>

                                            {openMenuId === b.id && (
                                                <div ref={menuRef} style={{
                                                    position: 'absolute', top: '110%', right: 0, zIndex: 20, minWidth: 210,
                                                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                                    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden'
                                                }}>
                                                    {(isLocalBook ? [
                                                        { icon: Edit2, label: 'Renommer', action: () => handleRename(b) },
                                                        { icon: InfoCircle, label: 'Détails', action: () => handleDetails(b, true) },
                                                        { icon: Trash, label: 'Supprimer', danger: true, action: () => handleRemove(b.id) },
                                                    ] : isOffline ? [
                                                        { icon: Trash, label: 'Supprimer le fichier hors-ligne', danger: true, action: () => handleRemove(b.id) },
                                                        { icon: InfoCircle, label: 'Détails', action: () => handleDetails(b, false) },
                                                    ] : [
                                                        { icon: DocumentDownload, label: 'Télécharger pour lire hors-ligne', action: () => handleDownload(b) },
                                                        { icon: InfoCircle, label: 'Détails', action: () => handleDetails(b, false) },
                                                    ]).map((item, i) => {
                                                        const ItemIcon = item.icon;
                                                        return (
                                                            <div
                                                                key={i}
                                                                onClick={() => { setOpenMenuId(null); item.action(); }}
                                                                style={{
                                                                    padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                                                                    borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                <ItemIcon size={16} color={item.danger ? 'var(--color-danger)' : 'var(--color-text-muted)'} variant="Linear" />
                                                                <span style={{ fontSize: 13, fontWeight: 600, color: item.danger ? 'var(--color-danger)' : 'var(--color-text)' }}>{item.label}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Formations — découverte secondaire, ligne compacte (déplacée depuis Home) */}
            {!isOfflineNow && (
                <div className="container" style={{ marginTop: 'var(--space-4)', padding: '0 4px' }}>
                    <div
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer'
                        }}
                        onClick={() => window.open('https://boombooks.shop/formations', '_blank')}
                    >
                        <Teacher size={22} color="var(--color-text-muted)" variant="Linear" />
                        <div style={{ flex: 1 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Formations Sélectionnées</h4>
                            <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>Catalogue des meilleures formations francophones, avec BoomBooks</p>
                        </div>
                        <ArrowRight size={18} color="var(--color-text-muted)" variant="Linear" />
                    </div>
                </div>
            )}
        </div>
    );
}
