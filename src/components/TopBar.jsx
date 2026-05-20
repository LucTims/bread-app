import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { InstallBanner, InstallMenuItem } from './InstallPrompt';

export default function TopBar() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Check if installed (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    const initial = (user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase();

    return (
        <>
            {/* ── Install Banner — always visible at very top ── */}
            {!isStandalone && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60 }}>
                    <InstallBanner />
                </div>
            )}

            {/* ── Header ── */}
            <header style={{ 
                padding: '0 var(--space-4)', 
                background: 'var(--color-bg)', 
                position: 'fixed', 
                top: isStandalone ? 0 : 44, 
                left: 0, width: '100%', zIndex: 50, 
                height: 'var(--header-height)', 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-border)',
                transition: 'top 0.3s ease'
            }}>
                <div style={{ position: 'relative' }} ref={menuRef}>
                    <button className="btn-ghost" style={{ padding: 4, borderRadius: 4 }} onClick={() => setMenuOpen(!menuOpen)}>
                        <span className="material-symbols-outlined">menu</span>
                    </button>

                    {menuOpen && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, marginTop: 8,
                            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                            minWidth: 220, zIndex: 100, overflow: 'hidden'
                        }}>
                            {/* Install App in menu */}
                            <InstallMenuItem onClick={() => setMenuOpen(false)} />

                            {[
                                { icon: 'library_books', label: 'Ma Bibliothèque', action: () => navigate('/library') },
                                { icon: 'settings', label: 'Paramètres', action: () => navigate('/settings') },
                                { icon: 'person', label: 'Profil', action: () => navigate('/profile') },
                                { icon: 'storefront', label: 'BoomBooks.shop', action: () => window.open('https://boombooks.shop', '_blank') },
                            ].map((item, i) => (
                                <div key={i}
                                    style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                                    onClick={() => { setMenuOpen(false); item.action(); }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>{item.icon}</span>
                                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{item.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <h1 style={{ fontFamily: 'var(--font-logo)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)' }}>BRead</h1>
                
                <div onClick={() => navigate('/profile')} style={{ 
                    width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)',
                    cursor: 'pointer', border: '1px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#000', fontSize: 14, fontWeight: 700, overflow: 'hidden'
                }}>
                    {user?.user_metadata?.avatar_url 
                        ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initial
                    }
                </div>
            </header>
        </>
    );
}
