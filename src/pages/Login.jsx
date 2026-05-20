import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const GOOGLE_SVG = (
    <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
);

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [view, setView] = useState('welcome');
    const [isInstallable, setIsInstallable] = useState(!!window.deferredPrompt);
    const { signIn, user } = useAuth();
    const navigate = useNavigate();

    const location = useLocation();
    const redirectUrl = new URLSearchParams(location.search).get('redirect') || '/';

    useEffect(() => { if (user) navigate(redirectUrl); }, [user, navigate, redirectUrl]);

    useEffect(() => {
        const onInstallable = () => setIsInstallable(true);
        const onInstalled = () => setIsInstallable(false);
        window.addEventListener('app-installable', onInstallable);
        window.addEventListener('app-installed', onInstalled);
        if (window.deferredPrompt) setIsInstallable(true);
        if (window.matchMedia('(display-mode: standalone)').matches) setIsInstallable(false);
        return () => {
            window.removeEventListener('app-installable', onInstallable);
            window.removeEventListener('app-installed', onInstalled);
        };
    }, []);

    const handleInstall = async () => {
        const p = window.deferredPrompt;
        if (!p) return;
        p.prompt();
        const { outcome } = await p.userChoice;
        if (outcome === 'accepted') { setIsInstallable(false); window.deferredPrompt = null; }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const { error } = await signIn(email, password);
        if (error) { setError(error.message); setLoading(false); }
        else navigate(redirectUrl);
    };

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        setError('');
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + redirectUrl,
                }
            });
            if (error) throw error;
        } catch (err) {
            setError(err.message || "Erreur de connexion Google.");
            setGoogleLoading(false);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { data, error: signUpErr } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } }
            });
            if (signUpErr) throw signUpErr;

            // Auto-login after sign up
            if (data?.user && !data.user.identities?.length === 0) {
                setError("Ce compte existe déjà. Connectez-vous.");
                setView('login');
            } else {
                // Try auto sign-in
                const { error: loginErr } = await signIn(email, password);
                if (loginErr) {
                    setError("Compte créé ! Vérifiez votre email puis connectez-vous.");
                    setView('login');
                } else {
                    navigate(redirectUrl);
                }
            }
        } catch (err) {
            setError(err.message || "Erreur lors de l'inscription.");
        } finally {
            setLoading(false);
        }
    };

    // ─── Separator ───
    const Divider = () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>ou</span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        </div>
    );

    // ─── Google Button ───
    const GoogleButton = ({ label }) => (
        <button onClick={handleGoogleLogin} disabled={googleLoading}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '14px 16px', borderRadius: 'var(--radius-full)',
                background: '#fff', border: '1px solid #dadce0',
                color: '#3c4043', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer', transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}
        >
            {googleLoading ? (
                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#4285F4', borderColor: 'rgba(66,133,244,0.3)' }} />
            ) : (
                <>{GOOGLE_SVG}<span>{label || 'Continuer avec Google'}</span></>
            )}
        </button>
    );

    // ─── Welcome Screen ───
    if (view === 'welcome') {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', textAlign: 'center' }}>

                {/* Install banner at the top */}
                {isInstallable && (
                    <div onClick={handleInstall} style={{
                        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
                        background: 'linear-gradient(135deg, #FFD700, #FFA000)',
                        padding: '12px 16px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        boxShadow: '0 2px 12px rgba(255,215,0,0.3)'
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#000' }}>install_mobile</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#000' }}>Installer l'App pour lire hors-ligne</span>
                        <span style={{ background: '#000', color: '#FFD700', padding: '4px 12px', borderRadius: 14, fontSize: 11, fontWeight: 700, marginLeft: 4 }}>Installer</span>
                    </div>
                )}

                <h1 style={{ fontFamily: 'var(--font-logo)', fontSize: 48, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>BRead</h1>
                <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, marginBottom: 'var(--space-4)', lineHeight: 1.2 }}>Votre liseuse hors-ligne.</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-8)', maxWidth: 300, lineHeight: 1.6 }}>
                    Lisez vos livres BoomBooks partout, même sans connexion. Une expérience de lecture premium et immersive.
                </p>

                <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <GoogleButton label="Continuer avec Google" />
                    <Divider />
                    <button className="btn btn-primary btn-lg btn-block" onClick={() => setView('login')}>
                        Se connecter par email
                    </button>
                    <button className="btn btn-outline btn-lg btn-block" onClick={() => setView('signup')}>
                        Créer un compte
                    </button>
                </div>

                {error && <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(228,30,63,0.1)', border: '1px solid rgba(228,30,63,0.3)', color: '#E41E3F', fontSize: 'var(--text-sm)', marginTop: 16, maxWidth: 320, width: '100%' }}>{error}</div>}

                <p style={{ color: 'var(--color-text-muted)', fontSize: 11, marginTop: 'var(--space-8)', maxWidth: 280, lineHeight: 1.5 }}>
                    Connectez-vous avec le même compte que sur boombooks.shop pour synchroniser vos livres.
                </p>
            </div>
        );
    }

    // ─── Sign Up Screen ───
    if (view === 'signup') {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 'var(--space-6)' }}>
                <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: '8px 0', marginBottom: 'var(--space-6)' }} onClick={() => setView('welcome')}>
                    <span className="material-symbols-outlined">arrow_back</span> Retour
                </button>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 400, margin: '0 auto', width: '100%' }}>
                    <h1 style={{ fontFamily: 'var(--font-logo)', fontSize: 32, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>BRead</h1>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-6)' }}>Créer votre compte</h2>
                    
                    {error && <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(228,30,63,0.1)', border: '1px solid rgba(228,30,63,0.3)', color: '#E41E3F', fontSize: 'var(--text-sm)', marginBottom: 16 }}>{error}</div>}

                    <GoogleButton label="S'inscrire avec Google" />
                    <Divider />

                    <form onSubmit={handleSignUp}>
                        <div style={{ marginBottom: 16, position: 'relative' }}>
                            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 20, pointerEvents: 'none' }}>person</span>
                            <input type="text" placeholder="Nom complet" value={fullName} onChange={e => setFullName(e.target.value)} className="form-input" style={{ padding: '16px 16px 16px 48px', borderRadius: 'var(--radius-full)', width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
                        </div>

                        <div style={{ marginBottom: 16, position: 'relative' }}>
                            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 20, pointerEvents: 'none' }}>email</span>
                            <input type="email" placeholder="Adresse email" value={email} onChange={e => setEmail(e.target.value)} required className="form-input" style={{ padding: '16px 16px 16px 48px', borderRadius: 'var(--radius-full)', width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
                        </div>

                        <div style={{ marginBottom: 24, position: 'relative' }}>
                            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 20, pointerEvents: 'none' }}>lock</span>
                            <input type="password" placeholder="Mot de passe (6+ caractères)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="form-input" style={{ padding: '16px 16px 16px 48px', borderRadius: 'var(--radius-full)', width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                            {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.3)' }} /> : "S'inscrire"}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                        Déjà un compte ? <button style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }} onClick={() => setView('login')}>Se connecter</button>
                    </p>
                </div>
            </div>
        );
    }

    // ─── Login Screen ───
    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 'var(--space-6)' }}>
            <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: '8px 0', marginBottom: 'var(--space-6)' }} onClick={() => setView('welcome')}>
                <span className="material-symbols-outlined">arrow_back</span> Retour
            </button>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 400, margin: '0 auto', width: '100%' }}>
                <h1 style={{ fontFamily: 'var(--font-logo)', fontSize: 32, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>BRead</h1>
                <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-6)' }}>Content de vous revoir.</h2>
                
                {error && <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(228,30,63,0.1)', border: '1px solid rgba(228,30,63,0.3)', color: '#E41E3F', fontSize: 'var(--text-sm)', marginBottom: 16 }}>{error}</div>}

                <GoogleButton label="Continuer avec Google" />
                <Divider />

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: 16, position: 'relative' }}>
                        <span className="material-symbols-outlined" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 20, pointerEvents: 'none' }}>email</span>
                        <input type="email" placeholder="Adresse email" value={email} onChange={e => setEmail(e.target.value)} required className="form-input" style={{ padding: '16px 16px 16px 48px', borderRadius: 'var(--radius-full)', width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
                    </div>

                    <div style={{ marginBottom: 24, position: 'relative' }}>
                        <span className="material-symbols-outlined" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 20, pointerEvents: 'none' }}>lock</span>
                        <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required className="form-input" style={{ padding: '16px 16px 16px 48px', borderRadius: 'var(--radius-full)', width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                        {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.3)' }} /> : 'Se connecter'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    Pas encore de compte ? <button style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }} onClick={() => setView('signup')}>Créer un compte</button>
                </p>
            </div>
        </div>
    );
}
