import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getAllOfflineBooks, getStorageUsage, formatSize } from '../lib/offlineStore';
import { InstallButton } from '../components/InstallPrompt';

export default function Profile() {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [stats, setStats] = useState({ booksOwned: 0, booksOffline: 0 });
    const [readingStats, setReadingStats] = useState({ pages: 0, streak: 0, longestStreak: 0 });
    const [storage, setStorage] = useState({ totalBytes: 0, bookCount: 0 });
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [bio, setBio] = useState('');
    const [name, setName] = useState('');
    const [editingBio, setEditingBio] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!user) return;
        
        const timer = setTimeout(() => {
            // Load avatar and bio from user_metadata
            setAvatarUrl(user.user_metadata?.avatar_url || null);
            setBio(user.user_metadata?.bio || '');
            setName(user.user_metadata?.full_name || user.user_metadata?.name || '');

            (async () => {
                try {
                    const { data: profileData } = await supabase
                        .from('profiles').select('total_pages_read, current_streak, longest_streak').eq('id', user.id).single();
                    if (profileData) {
                        setReadingStats({
                            pages: profileData.total_pages_read || 0,
                            streak: profileData.current_streak || 0,
                            longestStreak: profileData.longest_streak || 0
                        });
                    }

                    const { data: access } = await supabase
                        .from('user_book_access').select('id').eq('user_id', user.id);
                    const offBooks = await getAllOfflineBooks();
                    const storageInfo = await getStorageUsage();
                    setStats({ booksOwned: access?.length || 0, booksOffline: offBooks.length });
                    setStorage(storageInfo);
                } catch (err) { console.error('Profile stats error:', err); }
            })();
        }, 0);

        return () => clearTimeout(timer);
    }, [user]);

    const initial = (user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase();
    const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Utilisateur';

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            alert("La photo ne doit pas dépasser 2 Mo.");
            return;
        }
        setUploading(true);
        try {
            const ext = file.name.split('.').pop().toLowerCase();
            const filePath = `avatars/${user.id}.${ext}`;
            
            // Remove old avatar if exists (different extension)
            try {
                const { data: list } = await supabase.storage.from('covers').list('avatars', { search: user.id });
                if (list?.length) {
                    const toDelete = list.filter(f => f.name !== `${user.id}.${ext}`).map(f => `avatars/${f.name}`);
                    if (toDelete.length) await supabase.storage.from('covers').remove(toDelete);
                }
            } catch { /* ignore cleanup errors */ }

            const { error: uploadErr } = await supabase.storage
                .from('covers')
                .upload(filePath, file, { 
                    upsert: true, 
                    contentType: file.type,
                    cacheControl: '3600'
                });
            
            if (uploadErr) throw uploadErr;
            
            const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(filePath);
            
            // Cache-bust so the new image shows immediately
            const finalUrl = publicUrl + '?t=' + Date.now();
            
            await supabase.auth.updateUser({ data: { avatar_url: finalUrl } });
            await supabase.from('profiles').update({ avatar_url: finalUrl }).eq('id', user.id);
            setAvatarUrl(finalUrl);
        } catch (err) {
            console.error('Avatar upload error:', err);
            alert("Erreur: " + (err.message || "Impossible de télécharger la photo."));
        } finally {
            setUploading(false);
        }
    };

    const handleSaveBio = async () => {
        try {
            await supabase.auth.updateUser({ data: { bio } });
            setEditingBio(false);
        } catch (err) {
            console.error('Bio save error:', err);
        }
    };

    const handleSaveName = async () => {
        try {
            await supabase.auth.updateUser({ data: { full_name: name } });
            await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
            setEditingName(false);
        } catch (err) {
            console.error('Name save error:', err);
        }
    };

    return (
        <div style={{ paddingBottom: 'var(--space-8)' }}>
            {/* Header / Avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
                <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
                    <div style={{
                        width: 100, height: 100, borderRadius: '50%', overflow: 'hidden',
                        border: '3px solid var(--color-primary)', boxShadow: '0 0 20px rgba(255,215,0,0.2)'
                    }}>
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 'bold' }}>
                                {initial}
                            </div>
                        )}
                    </div>
                    {/* Camera button overlay */}
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{
                            position: 'absolute', bottom: 0, right: 0,
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--color-primary)', border: '2px solid var(--color-bg)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', boxShadow: 'var(--shadow-md)'
                        }}
                    >
                        {uploading 
                            ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.3)' }} />
                            : <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#000' }}>photo_camera</span>
                        }
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                </div>
                
                {/* Name / Display Name */}
                {editingName ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 4 }}>
                        <input 
                            value={name} 
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Votre nom"
                            style={{ 
                                padding: '6px 12px', borderRadius: 'var(--radius-md)', 
                                border: '1px solid var(--color-primary)', background: 'var(--color-surface)', 
                                color: 'var(--color-text)', textAlign: 'center', fontSize: 'var(--text-xl)', fontWeight: 700 
                            }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="btn btn-sm btn-primary" onClick={handleSaveName}>Enregistrer</button>
                            <button className="btn btn-sm btn-outline" onClick={() => { setEditingName(false); setName(user?.user_metadata?.full_name || ''); }}>Annuler</button>
                        </div>
                    </div>
                ) : (
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 4, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {displayName}
                        <button className="btn-ghost" onClick={() => setEditingName(true)} style={{ padding: 4, color: 'var(--color-text-muted)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                        </button>
                    </h2>
                )}
                
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 12, fontSize: 'var(--text-sm)' }}>{user?.email}</p>

                {/* Bio / Description */}
                {editingBio ? (
                    <div style={{ width: '100%', maxWidth: 300 }}>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Décrivez-vous en quelques mots..."
                            maxLength={120}
                            style={{
                                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                color: 'var(--color-text)', fontSize: 'var(--text-sm)',
                                resize: 'none', height: 70, fontFamily: 'inherit'
                            }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
                            <button className="btn btn-sm btn-primary" onClick={handleSaveBio}>Enregistrer</button>
                            <button className="btn btn-sm btn-outline" onClick={() => { setEditingBio(false); setBio(user?.user_metadata?.bio || ''); }}>Annuler</button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setEditingBio(true)} style={{
                        color: bio ? 'var(--color-text-muted)' : 'var(--color-primary)',
                        fontSize: 'var(--text-sm)', background: 'none', border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        maxWidth: 280, textAlign: 'center', lineHeight: 1.4
                    }}>
                        {bio || (
                            <>
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                                Ajouter une description
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Gamification / Sunk Cost Stats */}
            <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)', background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,140,0,0.1))', border: '1px solid rgba(255,215,0,0.2)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>local_fire_department</span>
                    Mes Statistiques de Lecture
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text)' }}>{readingStats.streak}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)', marginTop: 4 }}>SÉRIE (JOURS)</div>
                    </div>
                    <div style={{ width: 1, background: 'rgba(128,128,128,0.2)', margin: '0 10px' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text)' }}>{readingStats.pages}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)', marginTop: 4 }}>PAGES LUES</div>
                    </div>
                    <div style={{ width: 1, background: 'rgba(128,128,128,0.2)', margin: '0 10px' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-primary)' }}>{readingStats.longestStreak}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)', marginTop: 4 }}>RECORD (🔥)</div>
                    </div>
                </div>
            </div>

            {/* Stats */}
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

            {/* Storage */}
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

            {/* Install App */}
            <InstallButton style={{ marginBottom: 'var(--space-4)' }} />

            {/* Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-12)' }}>
                {(() => {
                    const profileLinks = [];
                    if (profile?.role === 'admin') {
                        profileLinks.push({ 
                            icon: 'admin_panel_settings', 
                            label: "Console d'Administration", 
                            sub: "Statistiques, installations PWA & données réelles", 
                            action: () => navigate('/admin') 
                        });
                    }
                    profileLinks.push(
                        { icon: 'manage_accounts', label: 'Paramètres du compte', action: () => navigate('/settings') },
                        { icon: 'library_books', label: 'Ma Bibliothèque', action: () => navigate('/library') },
                        { icon: 'storefront', label: 'Acheter des livres', sub: 'boombooks.shop', action: () => window.open('https://boombooks.shop', '_blank'), endIcon: 'open_in_new' },
                    );
                    return profileLinks.map((item, i) => (
                        <div key={i} className="card" style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={item.action}>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 'var(--space-4)' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>{item.icon}</span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{item.label}</h4>
                                {item.sub && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{item.sub}</p>}
                            </div>
                            <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>{item.endIcon || 'chevron_right'}</span>
                        </div>
                    ));
                })()}
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
