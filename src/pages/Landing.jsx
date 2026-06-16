import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useEffect } from 'react';

export default function Landing() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();

    // Redirection automatique pour les utilisateurs déjà connectés
    useEffect(() => {
        if (user && !loading) {
            navigate('/home');
        }
    }, [user, loading, navigate]);

    if (loading) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner"></div></div>;
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
            {/* Header / Nav */}
            <header style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontFamily: 'var(--font-logo)', fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.5px' }}>BRead</div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <a href="https://boombooks.shop" target="_blank" rel="noreferrer" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }} className="hide-on-mobile">Aller sur BoomBooks</a>
                    <button onClick={() => navigate('/login')} className="btn btn-primary btn-sm" style={{ fontWeight: 'bold' }}>Se Connecter</button>
                </div>
            </header>

            {/* Hero Section */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <section style={{ 
                    padding: 'clamp(60px, 15vh, 120px) var(--space-6)', 
                    textAlign: 'center', 
                    background: 'radial-gradient(circle at top, rgba(255,215,0,0.15) 0%, rgba(10,10,10,0) 70%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-6)',
                    position: 'relative'
                }}>
                    <div style={{ position: 'absolute', top: '10%', left: '10%', width: '300px', height: '300px', background: 'rgba(255,215,0,0.05)', filter: 'blur(100px)', borderRadius: '50%', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '250px', height: '250px', background: 'rgba(245,158,11,0.05)', filter: 'blur(80px)', borderRadius: '50%', pointerEvents: 'none' }} />

                    <div style={{ display: 'inline-block', padding: '6px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                        Nouveau : Mode hors-ligne disponible ✨
                    </div>

                    <h1 style={{ 
                        fontFamily: 'var(--font-slogan)', 
                        fontSize: 'clamp(44px, 8vw, 84px)', 
                        lineHeight: 1.05, 
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #FFF 0%, #FFD700 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: 'var(--space-2)',
                        maxWidth: '900px'
                    }}>
                        Vos livres BoomBooks,<br/>partout avec vous.
                    </h1>
                    <p style={{ 
                        fontSize: 'clamp(16px, 2vw, 20px)', 
                        color: 'var(--color-text-muted)', 
                        maxWidth: '600px', 
                        lineHeight: 1.6 
                    }}>
                        L'application officielle conçue exclusivement pour lire vos ouvrages achetés sur BoomBooks. Profitez d'une expérience de lecture premium, fluide et immersive.
                    </p>
                    
                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
                        <button onClick={() => window.open('https://boombooks.shop', '_blank')} className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 32px', fontSize: '18px', boxShadow: '0 8px 32px rgba(255,215,0,0.2)' }}>
                            <span className="material-symbols-outlined">shopping_bag</span>
                            Acheter des livres
                        </button>
                        <button onClick={() => navigate('/login')} className="btn btn-outline btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 32px', fontSize: '18px', border: '1px solid rgba(255,255,255,0.2)' }}>
                            Accéder à l'appli
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                </section>

                {/* Visual / Connection Section */}
                <section style={{ padding: 'var(--space-12) var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)', justifyContent: 'center', maxWidth: '1000px', width: '100%', alignItems: 'center' }}>
                        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-2)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', transform: 'perspective(1000px) rotateY(5deg)' }}>
                                <div style={{ background: 'var(--color-bg-dark)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <h3 style={{ fontSize: '32px', fontWeight: 800, color: '#FFF', letterSpacing: '-1px' }}>BoomBooks.shop</h3>
                                    <p style={{ color: 'var(--color-text-muted)', marginTop: '8px' }}>La boutique officielle</p>
                                    <div style={{ marginTop: '24px', display: 'flex', gap: '8px' }}>
                                        <div style={{ width: '40px', height: '60px', background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: '4px' }}></div>
                                        <div style={{ width: '40px', height: '60px', background: 'linear-gradient(135deg, #f093fb, #f5576c)', borderRadius: '4px' }}></div>
                                        <div style={{ width: '40px', height: '60px', background: 'linear-gradient(135deg, #4facfe, #00f2fe)', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                            </div>
                            <h4 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold' }}>1. Achetez vos livres</h4>
                            <p style={{ color: 'var(--color-text-muted)' }}>Trouvez et achetez vos ebooks préférés directement sur notre boutique BoomBooks.shop.</p>
                        </div>
                        
                        <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>sync_alt</span>
                        </div>
                        
                        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-2)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', transform: 'perspective(1000px) rotateY(-5deg)' }}>
                                <div style={{ background: 'var(--color-bg-dark)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(255,215,0,0.1), transparent)', pointerEvents: 'none' }} />
                                    <h3 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-1px', fontFamily: 'var(--font-logo)' }}>BRead</h3>
                                    <p style={{ color: 'var(--color-text-muted)', marginTop: '8px' }}>L'application de lecture</p>
                                    <div style={{ marginTop: '24px', width: '120px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: '60%', height: '100%', background: 'var(--color-primary)' }}></div>
                                    </div>
                                </div>
                            </div>
                            <h4 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold' }}>2. Lisez en toute fluidité</h4>
                            <p style={{ color: 'var(--color-text-muted)' }}>Ouvrez BRead, vos livres vous y attendent déjà. Profitez d'une liseuse conçue pour vous.</p>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section style={{ padding: 'var(--space-16) var(--space-6)', display: 'grid', gap: 'var(--space-6)', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                    <div className="card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', padding: 'var(--space-8)' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>wifi_off</span>
                        </div>
                        <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Lecture 100% Hors-Ligne</h3>
                        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>Téléchargez vos livres sur votre appareil et lisez-les n'importe où : dans l'avion, dans le métro ou en pleine nature, sans aucune connexion.</p>
                    </div>

                    <div className="card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', padding: 'var(--space-8)' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>devices</span>
                        </div>
                        <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Multi-Plateformes</h3>
                        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>Installez BRead comme une application native sur votre téléphone, tablette ou ordinateur. Reprenez votre lecture exactement là où vous l'avez laissée.</p>
                    </div>

                    <div className="card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', padding: 'var(--space-8)' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>tune</span>
                        </div>
                        <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Liseuse Personnalisable</h3>
                        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>Mode sombre, mode clair, tailles de police ajustables et navigation fluide. BRead s'adapte à vos préférences pour un confort des yeux optimal.</p>
                    </div>
                </section>
                
                {/* CTA Section */}
                <section style={{ padding: 'var(--space-16) var(--space-6)', textAlign: 'center', background: 'linear-gradient(to top, rgba(255,215,0,0.05) 0%, rgba(0,0,0,0) 100%)' }}>
                    <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, marginBottom: 'var(--space-6)' }}>Prêt à plonger dans votre prochain livre ?</h2>
                    <button onClick={() => navigate('/login')} className="btn btn-primary btn-lg" style={{ padding: '16px 40px', fontSize: '20px', borderRadius: 'var(--radius-full)' }}>
                        Se connecter à BRead
                    </button>
                </section>
            </main>

            {/* Footer */}
            <footer style={{ padding: 'var(--space-8) var(--space-6)', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'var(--color-bg-dark)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-4)' }}>
                    <span style={{ fontFamily: 'var(--font-logo)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>BRead</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>&times;</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)' }}>BoomBooks</span>
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>&copy; {new Date().getFullYear()} BRead App. L'application officielle de BoomBooks.</p>
            </footer>
        </div>
    );
}
