import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function TopBar() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [isInstallable, setIsInstallable] = useState(!!window.deferredPrompt);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    // Listen for PWA install availability
    useEffect(() => {
        const handleInstallable = () => setIsInstallable(true);
        window.addEventListener('app-installable', handleInstallable);
        // Check immediately in case it was already set
        if (window.deferredPrompt) setIsInstallable(true);
        return () => window.removeEventListener('app-installable', handleInstallable);
    }, []);

    const handleInstallApp = async () => {
        const promptEvent = window.deferredPrompt;
        if (!promptEvent) return;
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
            setIsInstallable(false);
            window.deferredPrompt = null;
        }
        setMenuOpen(false);
    };

    return (
        <header style={{ 
            padding: '0 var(--space-4)', 
            background: 'var(--color-bg)', 
            position: 'fixed', 
            top: 0, 
            left: 0,
            width: '100%', 
            zIndex: 50, 
            height: 'var(--header-height)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--color-border)'
        }}>
            <div style={{ position: 'relative' }} ref={menuRef}>
                <button 
                    className="btn-ghost" 
                    style={{ padding: 4, borderRadius: 4 }}
                    onClick={() => setMenuOpen(!menuOpen)}
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>

                {/* Dropdown Menu */}
                {menuOpen && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: 8,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-lg)',
                        minWidth: 220,
                        zIndex: 100,
                        overflow: 'hidden'
                    }}>
                        {/* Install App Button */}
                        {isInstallable && (
                            <div 
                                style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: 'var(--color-primary-light)' }}
                                onClick={handleInstallApp}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-primary)' }}>install_mobile</span>
                                <div>
                                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-primary)' }}>Installer l'App</span>
                                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>Lire hors-ligne</p>
                                </div>
                            </div>
                        )}

                        <div 
                            style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                            onClick={() => { setMenuOpen(false); navigate('/library'); }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>library_books</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Ma Bibliothèque</span>
                        </div>
                        <div 
                            style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                            onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>settings</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Paramètres</span>
                        </div>
                        <div 
                            style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                            onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>person</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Profil</span>
                        </div>
                        <div 
                            style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                            onClick={() => { setMenuOpen(false); window.open('https://boombooks.shop', '_blank'); }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>storefront</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>BoomBooks.shop</span>
                        </div>
                    </div>
                )}
            </div>
            
            <h1 style={{ 
                fontFamily: 'var(--font-logo)', 
                fontSize: 'var(--text-xl)', 
                fontWeight: 700, 
                color: 'var(--color-text)' 
            }}>BRead</h1>
            
            <div 
                onClick={() => navigate('/profile')}
                style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '50%', 
                    background: 'var(--color-primary)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    fontSize: 14,
                    fontWeight: 700
                }}
            >
                {(user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
        </header>
    );
}
