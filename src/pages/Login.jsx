import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { InstallBanner } from '../components/InstallPrompt';

const GOOGLE_SVG = (
    <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
);

const Divider = () => (
    <div className="login-divider">
        <div className="login-divider-line" />
        <span className="login-divider-text">ou</span>
        <div className="login-divider-line" />
    </div>
);

const GoogleButton = ({ label, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} className="btn-social">
        {disabled ? (
            <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#4285F4', borderColor: 'rgba(66,133,244,0.3)' }} />
        ) : (
            <>{GOOGLE_SVG}<span>{label || 'Connexion avec Google'}</span></>
        )}
    </button>
);

export default function Login() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [view, setView] = useState('login'); // simplified: just login or signup directly
    const [showPassword, setShowPassword] = useState(false);
    
    const { signIn, user } = useAuth();
    const navigate = useNavigate();

    const location = useLocation();
    const redirectUrl = new URLSearchParams(location.search).get('redirect') || '/home';

    useEffect(() => { if (user) navigate(redirectUrl); }, [user, navigate, redirectUrl]);

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

            if (data?.user && !data.user.identities?.length === 0) {
                setError("Ce compte existe déjà. Connectez-vous.");
                setView('login');
            } else {
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

    return (
        <div className="login-layout">
            {/* Left side: Image */}
            <div className="login-image-side">
                <img src="/login-cover.png" alt="Lecture confortable" className="login-cover-img" />
                <div className="login-image-overlay">
                </div>
            </div>

            {/* Right side: Form */}
            <div className="login-form-side" style={{ padding: isStandalone ? 'var(--space-6)' : 'calc(44px + var(--space-6)) var(--space-6) var(--space-6)' }}>
                {!isStandalone && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60 }}>
                        <InstallBanner />
                    </div>
                )}
                
                <div className="login-form-container">
                    <Link to="/" style={{ textDecoration: 'none', display: 'block', width: 'fit-content', margin: '0 auto' }}><h1 className="login-brand">BRead</h1></Link>
                    <h2 className="login-title">
                        {view === 'login' ? 'Ravis de vous revoir !' : 'Créer votre compte'}
                    </h2>
                    
                    {error && <div className="login-error">{error}</div>}

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                        <GoogleButton 
                            label={view === 'login' ? "Connexion avec Google" : "S'inscrire avec Google"} 
                            onClick={handleGoogleLogin} 
                            disabled={googleLoading} 
                        />
                    </div>
                    
                    <Divider />

                    {view === 'login' ? (
                        <form onSubmit={handleLogin} className="login-form">
                            <div className="login-input-group">
                                <input 
                                    type="email" 
                                    placeholder="E-mail" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    required 
                                    className="login-input" 
                                />
                            </div>

                            <div className="login-input-group">
                                <input 
                                    type={showPassword ? 'text' : 'password'} 
                                    placeholder="Mot de passe" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    required 
                                    className="login-input" 
                                />
                                <button type="button" className="login-pwd-toggle" onClick={() => setShowPassword(!showPassword)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>

                            <button type="submit" className="login-submit-btn" disabled={loading}>
                                {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> : 'Se connecter'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleSignUp} className="login-form">
                            <div className="login-input-group">
                                <input type="text" placeholder="Nom complet" value={fullName} onChange={e => setFullName(e.target.value)} className="login-input" />
                            </div>

                            <div className="login-input-group">
                                <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required className="login-input" />
                            </div>

                            <div className="login-input-group">
                                <input type={showPassword ? 'text' : 'password'} placeholder="Mot de passe (6+ car.)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="login-input" />
                                <button type="button" className="login-pwd-toggle" onClick={() => setShowPassword(!showPassword)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>

                            <button type="submit" className="login-submit-btn" disabled={loading}>
                                {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> : 'Créer mon compte'}
                            </button>
                        </form>
                    )}

                    {view === 'login' && (
                        <div style={{ textAlign: 'center', margin: '16px 0' }}>
                            <a href="#" className="login-link-muted" onClick={(e) => { e.preventDefault(); /* TODO: Reset pwd */ }}>Mot de passe oublié ?</a>
                        </div>
                    )}

                    <div style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
                        <span style={{ color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
                            {view === 'login' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
                        </span>
                        <button className="login-link-bold" onClick={() => setView(view === 'login' ? 'signup' : 'login')}>
                            {view === 'login' ? 'Créer mon compte' : 'Se connecter'}
                        </button>
                    </div>

                    {/* Trust/Reviews Section */}
                    <div className="login-trust-section">
                        <div className="login-stars">
                            <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text)', marginTop: 4 }}>
                            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                <strong>Excellent</strong> | +30 avis positifs sur <span style={{ textDecoration: 'underline', color: 'var(--color-primary-text)' }}>Facebook</span>
                            </a>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
