import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function TopBar() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [isInstallable, setIsInstallable] = useState(!!window.deferredPrompt);
    const menuRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    useEffect(() => {
        const onInstallable = () => setIsInstallable(true);
        const onInstalled = () => setIsInstallable(false);
        window.addEventListener('app-installable', onInstallable);
        window.addEventListener('app-installed', onInstalled);
        // Check if already installable (event may have fired before React mounted)
        if (window.deferredPrompt) setIsInstallable(true);
        // Check if already installed (standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) setIsInstallable(false);
        return () => {
            window.removeEventListener('app-installable', onInstallable);
            window.removeEventListener('app-installed', onInstalled);
        };
    }, []);

    const handleInstallApp = async () => {
        const p = window.deferredPrompt;
        if (!p) return;
        p.prompt();
        const { outcome } = await p.userChoice;
        if (outcome === 'accepted') { setIsInstallable(false); window.deferredPrompt = null; }
        setMenuOpen(false);
    };

    const initial = (user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase();

    return (
        <>
            {/* ── Install Banner — always visible at very top ── */}
            {isInstallable && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
                    background: 'linear-gradient(135deg, #FFD700, #FFA000)',
                    padding: '10px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    boxShadow: '0 2px 12px rgba(255,215,0,0.3)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#000' }}>install_mobile</span>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#000', lineHeight: 1.2 }}>Installer l'App</p>
                            <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.6)' }}>Lire hors-ligne</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={handleInstallApp} style={{
                            background: '#000', color: '#FFD700', border: 'none', padding: '7px 16px',
                            borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer'
                        }}>Installer</button>
                        <button onClick={() => { setIsInstallable(false); }} style={{
                            background: 'none', border: 'none', color: 'rgba(0,0,0,0.5)', cursor: 'pointer', padding: 4
                        }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <header style={{ 
                padding: '0 var(--space-4)', 
                background: 'var(--color-bg)', 
                position: 'fixed', 
                top: isInstallable ? 44 : 0, 
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
