import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

export default function Settings() {
    const { signOut } = useAuth();
    // Initialize state from local storage or default to dark
    const [darkTheme, setDarkTheme] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) return savedTheme === 'dark';
        return true; // default dark
    });

    const toggleTheme = () => {
        const newTheme = !darkTheme;
        setDarkTheme(newTheme);
        const themeValue = newTheme ? 'dark' : 'light';
        localStorage.setItem('theme', themeValue);
        document.documentElement.setAttribute('data-theme', themeValue);
    };

    return (
        <div style={{ paddingBottom: 'var(--space-8)' }}>
            <div style={{ marginBottom: 'var(--space-8)' }}>
                <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Settings</h1>
                <p style={{ color: 'var(--color-text-muted)' }}>Manage your reading experience and account preferences.</p>
            </div>

            <h4 style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', textTransform: 'uppercase' }}>Preferences</h4>
            
            <div className="card" style={{ padding: 0, marginBottom: 'var(--space-8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)', marginRight: 'var(--space-4)' }}>language</span>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Language Selection</h4>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>English (US)</p>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-5)' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)', marginRight: 'var(--space-4)' }}>dark_mode</span>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Dark Theme</h4>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Optimize for night reading</p>
                    </div>
                    <div 
                        onClick={toggleTheme}
                        style={{ 
                            width: 50, 
                            height: 26, 
                            borderRadius: 13, 
                            background: darkTheme ? 'var(--color-primary)' : 'var(--color-border)', 
                            position: 'relative', 
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <div style={{ 
                            width: 22, 
                            height: 22, 
                            borderRadius: '50%', 
                            background: darkTheme ? '#1877F2' : '#fff', 
                            position: 'absolute', 
                            top: 2, 
                            left: darkTheme ? 26 : 2, 
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                            {darkTheme && <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#fff', fontWeight: 700 }}>check</span>}
                        </div>
                    </div>
                </div>
            </div>

            <h4 style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', textTransform: 'uppercase' }}>Account & Security</h4>
            
            <div className="card" style={{ padding: 0, marginBottom: 'var(--space-12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)', marginRight: 'var(--space-4)' }}>lock</span>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Security Settings</h4>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Password, 2FA, connected devices</p>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-5)' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)', marginRight: 'var(--space-4)' }}>manage_accounts</span>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Account Management</h4>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Personal info, subscription details</p>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button style={{ 
                    width: '100%', 
                    padding: '16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer'
                }} onClick={signOut}>
                    <span className="material-symbols-outlined" style={{ color: '#FFB4B4', marginRight: 12 }}>logout</span>
                    <span style={{ color: '#FFB4B4', fontWeight: 600, letterSpacing: 0.5, fontSize: 16 }}>Sign Out</span>
                </button>
            </div>
        </div>
    );
}
