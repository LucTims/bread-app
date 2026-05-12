import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('welcome'); // 'welcome' or 'login'
    const { signIn, user } = useAuth();
    const navigate = useNavigate();

    const location = useLocation();
    
    // Extraire le paramètre de redirection
    const redirectUrl = new URLSearchParams(location.search).get('redirect') || '/';

    useEffect(() => { if (user) navigate(redirectUrl); }, [user, navigate, redirectUrl]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const { error } = await signIn(email, password);
        if (error) { setError(error.message); setLoading(false); }
        else navigate(redirectUrl);
    };

    if (view === 'welcome') {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', textAlign: 'center' }}>
                <h1 style={{ fontFamily: 'var(--font-logo)', fontSize: 48, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>BRead</h1>
                <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, marginBottom: 'var(--space-6)', lineHeight: 1.2 }}>The Future of Reading.</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-12)', maxWidth: 300, lineHeight: 1.6 }}>
                    Immersive, premium, and designed for the modern intellectual. Curate your library and elevate your mind.
                </p>
                
                <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <button className="btn btn-primary btn-lg btn-block" onClick={() => alert('Sign up flow not implemented yet.')}>
                        Sign Up
                    </button>
                    <button className="btn btn-outline btn-lg btn-block" onClick={() => setView('login')}>
                        Log In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 'var(--space-6)' }}>
            <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: '8px 0', marginBottom: 'var(--space-8)' }} onClick={() => setView('welcome')}>
                <span className="material-symbols-outlined">arrow_back</span> Back
            </button>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 400, margin: '0 auto', width: '100%' }}>
                <h1 style={{ fontFamily: 'var(--font-logo)', fontSize: 32, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>BRead</h1>
                <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-8)' }}>Welcome back.</h2>
                
                {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ position: 'relative' }}>
                            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 20, pointerEvents: 'none' }}>mail</span>
                            <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="form-input" style={{ paddingLeft: 48, padding: '16px 16px 16px 48px', borderRadius: 'var(--radius-full)' }} />
                        </div>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <div style={{ position: 'relative' }}>
                            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 20, pointerEvents: 'none' }}>lock</span>
                            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="form-input" style={{ paddingLeft: 48, padding: '16px 16px 16px 48px', borderRadius: 'var(--radius-full)' }} />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                        {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.3)' }} /> : 'Log In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
