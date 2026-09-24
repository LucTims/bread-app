import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
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
            <div className="login-form-side" style={{ padding: 'var(--space-6)' }}>
                <div className="login-form-container">
                    <Link to="/" style={{ textDecoration: 'none', display: 'block', width: 'fit-content', margin: '0 auto' }}><h1 className="login-brand">BoomRead</h1></Link>
                    <h2 className="login-title">
                        {view === 'login' ? 'Ravis de vous revoir !' : 'Créer votre compte'}
                    </h2>
                    
                    {error && <div className="login-error">{error}</div>}

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
