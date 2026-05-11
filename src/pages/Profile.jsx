import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    return (
        <div style={{ paddingBottom: 'var(--space-8)' }}>
            {/* Header / Avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--space-8)', marginTop: 'var(--space-4)' }}>
                <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
                    <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--color-surface)', boxShadow: 'var(--shadow-md)' }}>
                        <img src="https://i.pravatar.cc/150?img=11" alt="Amara Diallo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <button style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, background: 'var(--color-surface)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-border)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                    </button>
                </div>
                
                <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 8 }}>Amara Diallo</h2>
                <div className="badge" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 4 }}>workspace_premium</span>
                    PREMIUM MEMBER
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6) var(--space-4)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-primary)', marginBottom: 8 }}>menu_book</span>
                    <h3 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, lineHeight: 1 }}>142</h3>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)', marginTop: 4 }}>BOOKS READ</p>
                </div>
                <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6) var(--space-4)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-primary)', marginBottom: 8 }}>hourglass_empty</span>
                    <h3 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, lineHeight: 1 }}>850</h3>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)', marginTop: 4 }}>HOURS READ</p>
                </div>
            </div>

            {/* Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-12)' }}>
                <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/settings')}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 'var(--space-4)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>manage_accounts</span>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Account Settings</h4>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                </div>

                <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 'var(--space-4)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>track_changes</span>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Reading Goals</h4>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                </div>

                <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 'var(--space-4)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>format_quote</span>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Saved Quotes</h4>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-outline" style={{ borderColor: 'var(--color-border)', width: '80%' }} onClick={signOut}>
                    <span className="material-symbols-outlined" style={{ color: '#E41E3F' }}>logout</span>
                    <span style={{ color: '#E41E3F', fontWeight: 600, letterSpacing: 1, fontSize: 12 }}>SIGN OUT</span>
                </button>
            </div>
        </div>
    );
}
