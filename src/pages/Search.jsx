import { useNavigate } from 'react-router-dom';
import { ArrowLeft2, SearchNormal1, SearchStatus } from 'iconsax-react';

export default function Search() {
    const navigate = useNavigate();

    return (
        <div style={{ paddingBottom: 'var(--space-8)' }}>
            <div style={{ marginTop: 2, marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 10 }}>
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
                <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Rechercher</h1>
            </div>

            <div className="search-bar">
                <SearchNormal1 size={20} color="var(--color-text-muted)" variant="Linear" />
                <input type="text" placeholder="Titre, auteur, catégorie..." autoFocus />
            </div>

            <div className="empty-state" style={{ paddingTop: 60 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <SearchStatus size={48} color="var(--color-text-muted)" variant="Linear" />
                </div>
                <h3 style={{ fontWeight: 600, marginTop: 16 }}>Trouvez votre prochaine lecture</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
                    Recherchez dans notre catalogue de livres.
                </p>
            </div>
        </div>
    );
}
