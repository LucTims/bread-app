import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('welcome'); // 'welcome' | 'login' | 'signup'
    const { signIn, user } = useAuth();
    const navigate = useNavigate();

    const location = useLocation();
    const redirectUrl = new URLSearchParams(location.search).get('redirect') || '/';

    useEffect(() => { if (user) navigate(redirectUrl); }, [user, navigate, redirectUrl]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const { error } = await signIn(email, password);
        if (error) { setError(error.message); setLoading(false); }
        else navigate(redirectUrl);
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

    // ─── Welcome Screen ───
    if (view === 'welcome') {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', textAlign: 'center' }}>
                <h1 style={{ fontFamily: 'var(--font-logo)', fontSize: 48, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>BRead</h1>
                <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, marginBottom: 'var(--space-6)', lineHeight: 1.2 }}>Votre liseuse hors-ligne.</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-12)', maxWidth: 300, lineHeight: 1.6 }}>
                    Lisez vos livres BoomBooks partout, même sans connexion. Une expérience de lecture premium et immersive.
                </p>
                
                <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <button className="btn btn-primary btn-lg btn-block" onClick={() => setView('signup')}>
                        Créer un compte
                    </button>
                    <button className="btn btn-outline btn-lg btn-block" onClick={() => setView('login')}>
                        Se connecter
                    </button>
                </div>
            </div>
        );
    }

    // ─── Sign Up Screen ───
    if (view === 'signup') {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 'var(--space-6)' }}>
                <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: '8px 0', marginBottom: 'var(--space-8)' }} onClick={() => setView('welcome')}>
                    <span className="material-symbols-outlined">arrow_back</span> Retour
                </button>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 400, margin: '0 auto', width: '100%' }}>
                    <h1 style={{ fontFamily: 'var(--font-logo)', fontSize: 32, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>BRead</h1>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-8)' }}>Créer votre compte</h2>
                    
                    {error && <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(228,30,63,0.1)', border: '1px solid rgba(228,30,63,0.3)', color: '#E41E3F', fontSize: 'var(--text-sm)', marginBottom: 16 }}>{error}</div>}

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
            <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: '8px 0', marginBottom: 'var(--space-8)' }} onClick={() => setView('welcome')}>
                <span className="material-symbols-outlined">arrow_back</span> Retour
            </button>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 400, margin: '0 auto', width: '100%' }}>
                <h1 style={{ fontFamily: 'var(--font-logo)', fontSize: 32, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>BRead</h1>
                <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-8)' }}>Content de vous revoir.</h2>
                
                {error && <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(228,30,63,0.1)', border: '1px solid rgba(228,30,63,0.3)', color: '#E41E3F', fontSize: 'var(--text-sm)', marginBottom: 16 }}>{error}</div>}

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
