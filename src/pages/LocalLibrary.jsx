import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pdfjs } from 'react-pdf';
import { 
    getOfflineBooksSync, 
    getAllOfflineBooks, 
    removeOfflineBook,
    saveLocalBook,
    preloadCoverUrls,
    formatSize
} from '../lib/offlineStore';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const extractPdfCover = async (file) => {
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

export default function LocalLibrary() {
    const navigate = useNavigate();
    
    // On charge depuis l'index local d'abord, on filtre uniquement les locaux
    const syncBooks = getOfflineBooksSync().filter(b => b.isLocal);
    
    const [books, setBooks] = useState(syncBooks);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [coverUrls, setCoverUrls] = useState({});
    const [showBanner, setShowBanner] = useState(true);
    const fileInputRef = useRef(null);

    const refreshBooks = async () => {
        const all = await getAllOfflineBooks();
        const localBooks = all.filter(b => b.isLocal);
        setBooks(localBooks);
        const urls = await preloadCoverUrls(localBooks.map(b => b.id));
        setCoverUrls(urls);
    };

    useEffect(() => {
        refreshBooks();
    }, []);

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    const coverUrl = await extractPdfCover(file);
                    await saveLocalBook(file, coverUrl);
                } else if (file.name.toLowerCase().endsWith('.epub')) {
                    await saveLocalBook(file, null);
                } else {
                    alert(`Le fichier ${file.name} n'est pas un format supporté (PDF/EPUB requis).`);
                }
            }
            await refreshBooks();
        } catch (err) {
            console.error('Erreur lors de l\'importation :', err);
            alert('Une erreur est survenue lors de l\'importation.');
        } finally {
            setLoading(false);
            // Réinitialiser l'input
            e.target.value = '';
        }
    };

    const handleRemove = async (bookId) => {
        if (!confirm('Supprimer ce livre de votre téléphone ?')) return;
        await removeOfflineBook(bookId);
        setBooks(prev => prev.filter(b => b.id !== bookId));
    };

    const filteredBooks = books.filter(b => {
        return searchQuery.trim() === '' || 
            b.title.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const totalSize = books.reduce((sum, b) => sum + (b.sizeBytes || 0), 0);

    return (
        <div style={{ paddingBottom: 40 }}>
            {/* Input file caché */}
            <input 
                type="file" 
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="application/pdf,application/epub+zip,.pdf,.epub"
                multiple
                onChange={handleFileChange}
            />

            {/* Hero Dashboard */}
            {showBanner && (
                <div className="library-hero" style={{ position: 'relative', padding: '24px 0 20px', borderRadius: 16, margin: '12px var(--space-4) 0', background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => setShowBanner(false)} style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#fff' }}>close</span>
                    </button>
                    <div className="container">
                        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, background: 'linear-gradient(90deg, #FFD700, #FFA000)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Local</h1>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, margin: '4px 0 0' }}>Fichiers importés depuis votre appareil</p>
                        
                        <div className="library-stats-container" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div className="library-stat-card">
                                <span className="library-stat-card-label" style={{ color: 'rgba(255,255,255,0.6)' }}>LIVRES IMPORTÉS</span>
                                <span className="library-stat-card-value" style={{ color: '#fff' }}>{books.length}</span>
                            </div>
                            <div className="library-stat-card">
                                <span className="library-stat-card-label" style={{ color: 'rgba(255,255,255,0.6)' }}>ESPACE UTILISÉ</span>
                                <span className="library-stat-card-value" style={{ color: '#fff' }}>{formatSize(totalSize)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="container" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <button 
                        className="btn btn-primary" 
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 12 }}
                        onClick={handleImportClick}
                        disabled={loading}
                    >
                        {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(0,0,0,0.3)', borderTopColor: '#000' }} /> : <span className="material-symbols-outlined">add_circle</span>}
                        <span style={{ fontWeight: 700 }}>Importer des fichiers</span>
                    </button>
                </div>

                <div className="library-search-wrap">
                    <span className="material-symbols-outlined">search</span>
                    <input 
                        type="text" 
                        placeholder="Rechercher un fichier importé..." 
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

            {/* Grid */}
            <div className="container" style={{ marginTop: 12 }}>
                {filteredBooks.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 44, color: 'var(--color-text-muted)', opacity: 0.3 }}>
                            folder_open
                        </span>
                        <h3 style={{ fontWeight: 700, marginTop: 12, fontSize: 14, margin: '8px 0 4px' }}>
                            {searchQuery ? 'Aucun résultat' : 'Aucun fichier'}
                        </h3>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, margin: 0 }}>
                            {searchQuery ? 'Essayez avec un autre nom.' : 'Cliquez sur Importer pour ajouter vos propres PDF et EPUB.'}
                        </p>
                    </div>
                ) : (
                    <div className="book-grid">
                        {filteredBooks.map(b => (
                            <div key={b.id} className="book-card" onClick={() => navigate(`/read/${b.id}`)}>
                                <div className="book-cover-wrap" style={{ background: getBookGradient(b.id) }}>
                                    {coverUrls[b.id] ? (
                                        <img src={coverUrls[b.id]} alt={b.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.7)' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.8 }}>
                                                {b.title.toLowerCase().endsWith('.epub') ? 'menu_book' : 'picture_as_pdf'}
                                            </span>
                                            <span style={{ fontSize: 10, fontWeight: 700, marginTop: 8, letterSpacing: 1 }}>{b.title.toLowerCase().endsWith('.epub') ? 'EPUB' : 'PDF'}</span>
                                        </div>
                                    )}
                                    
                                    <div className="book-action-overlay">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRemove(b.id); }}
                                            className="book-badge-icon delete-badge" 
                                            title="Supprimer du téléphone"
                                            style={{ border: 'none', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.95)', borderColor: '#ef4444' }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#fff' }}>delete</span>
                                        </button>
                                    </div>
                                </div>
                                
                                <h4 className="book-title line-clamp-2" title={b.title}>{b.title}</h4>
                                <p className="book-author line-clamp-1">{formatSize(b.sizeBytes)} • Local</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
