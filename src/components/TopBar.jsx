import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function TopBar() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
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

    return (
        <header style={{ 
            padding: 'var(--space-4)', 
            background: 'var(--color-bg)', 
            position: 'fixed', 
            top: 0, 
            width: '100%', 
            zIndex: 10, 
            height: 'var(--header-height)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
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
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-lg)',
                        minWidth: 200,
                        zIndex: 20,
                        overflow: 'hidden'
                    }}>
                        <div 
                            style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                            onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>settings</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Settings</span>
                        </div>
                        <div 
                            style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                            onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>person</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Profile</span>
                        </div>
                        <div 
                            style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                            onClick={() => { setMenuOpen(false); alert('Help section not implemented yet'); }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>help</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Help & Support</span>
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
