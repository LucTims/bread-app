import { useNavigate } from 'react-router-dom';

export default function OfflineStatus() {
    const navigate = useNavigate();

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-6)' }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-8)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 64, color: 'var(--color-text-muted)' }}>wifi_off</span>
            </div>
            
            <h1 style={{ fontSize: 'var(--text-4xl)', fontWeight: 700, marginBottom: 'var(--space-4)', lineHeight: 1.2 }}>You are<br/>offline.</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-8)', maxWidth: 300, lineHeight: 1.6 }}>
                Your downloaded books are available for reading. Reconnect to sync progress and discover new titles.
            </p>
            
            <button className="btn btn-primary btn-lg" style={{ width: '100%', maxWidth: 300 }} onClick={() => navigate('/library')}>
                <span className="material-symbols-outlined">library_books</span> Go to Library
            </button>
        </div>
    );
}
