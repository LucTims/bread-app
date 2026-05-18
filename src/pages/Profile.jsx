import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getAllOfflineBooks, getStorageUsage, formatSize } from '../lib/offlineStore';

export default function Profile() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ booksOwned: 0, booksOffline: 0 });
    const [storage, setStorage] = useState({ totalBytes: 0, bookCount: 0 });

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                // Count books the user has access to
                const { data: access } = await supabase
                    .from('user_book_access')
                    .select('id')
                    .eq('user_id', user.id);
                
                const offBooks = await getAllOfflineBooks();
                const storageInfo = await getStorageUsage();
                
                setStats({
                    booksOwned: access?.length || 0,
                    booksOffline: offBooks.length
                });
                setStorage(storageInfo);
            } catch (err) {
                console.error('Profile stats error:', err);
            }
        })();
    }, [user]);

    const initial = (user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase();
    const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Utilisateur';

    return (
        <div style={{ paddingBottom: 'var(--space-8)' }}>
            {/* Header / Avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--space-8)', marginTop: 'var(--space-4)' }}>
                <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
                    <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--color-surface)', boxShadow: 'var(--shadow-md)' }}>
                        <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 'bold' }}>
                            {initial}
                        </div>
                    </div>
                </div>
                
                <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
                    {displayName}
                </h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 12 }}>{user?.email}</p>
            </div>

            {/* Stats - real data */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6) var(--space-4)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-primary)', marginBottom: 8 }}>menu_book</span>
                    <h3 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, lineHeight: 1 }}>{stats.booksOwned}</h3>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)', marginTop: 4 }}>LIVRES ACHETÉS</p>
                </div>
                <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6) var(--space-4)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-primary)', marginBottom: 8 }}>download_done</span>
                    <h3 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, lineHeight: 1 }}>{stats.booksOffline}</h3>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)', marginTop: 4 }}>HORS-LIGNE</p>
                </div>
            </div>

            {/* Storage info */}
            {storage.totalBytes > 0 && (
                <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Stockage local</span>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{formatSize(storage.totalBytes)}</span>
                    </div>
                    <div className="storage-bar">
                        <div className="storage-fill" style={{ width: `${Math.min(100, (storage.totalBytes / (500 * 1024 * 1024)) * 100)}%` }} />
                    </div>
                </div>
            )}

            {/* Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-12)' }}>
                <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/settings')}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 'var(--space-4)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>manage_accounts</span>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Paramètres du compte</h4>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                </div>

                <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/library')}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 'var(--space-4)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>library_books</span>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Ma Bibliothèque</h4>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                </div>

                <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => window.open('https://boombooks.shop', '_blank')}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 'var(--space-4)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>storefront</span>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Acheter des livres</h4>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>boombooks.shop</p>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>open_in_new</span>
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-outline" style={{ borderColor: 'var(--color-border)', width: '80%' }} onClick={signOut}>
                    <span className="material-symbols-outlined" style={{ color: '#E41E3F' }}>logout</span>
                    <span style={{ color: '#E41E3F', fontWeight: 600, letterSpacing: 1, fontSize: 12 }}>SE DÉCONNECTER</span>
                </button>
            </div>
        </div>
    );
}
