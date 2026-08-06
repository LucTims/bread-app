import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import heroVideo from '../assets/animation/ChengYiUniverse888_pindown.io_1781629419.mp4';
import ecosystemImg from '../assets/ecosystem_illustration.jpg';
import premiumImg from '../assets/premium_reading.jpg';
import logoImg from '../assets/logo.jpg';

// Configuration des animations
const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.2 }
    }
};

const scaleUp = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut" } }
};

export default function Landing() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();

    // Redirection automatique
    useEffect(() => {
        if (user && !loading) {
            navigate('/home');
        }
    }, [user, loading, navigate]);

    if (loading) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}><div className="spinner"></div></div>;
    }

    // Couleurs pour le Hero (sombre)
    const heroColors = {
        bg: '#374151', // Gris cassé (foncé)
        text: '#f3f4f6',
        textMuted: '#9ca3af',
    };

    // Couleurs pour le reste du site (clair - Style Tribbut)
    const lightColors = {
        bg: '#f9fafb', // neutral-50
        bgWhite: '#ffffff',
        text: '#111827', // gray-900
        textMuted: '#4b5563', // gray-600
        border: '#e5e7eb', // gray-200
        primary: 'var(--color-primary)', // gold
    };

    return (
        <div style={{ minHeight: '100vh', background: lightColors.bg, color: lightColors.text, display: 'flex', flexDirection: 'column', overflowX: 'hidden', fontFamily: 'var(--font-sans)' }}>
            
            {/* 1. SECTION HERO (Sombre avec Vidéo) */}
            <section style={{ 
                position: 'relative',
                minHeight: '75vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: heroColors.bg,
                paddingBottom: '40px'
            }}>
                <video 
                    src={heroVideo} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover', 
                        zIndex: 0,
                        opacity: 0.6
                    }}
                />
                <div style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    background: `linear-gradient(to bottom, rgba(55, 65, 81, 0.4) 0%, rgba(55, 65, 81, 0.9) 100%)`, 
                    zIndex: 1 
                }} />

                <header style={{ 
                    padding: 'var(--space-4) var(--space-6)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    position: 'relative', 
                    zIndex: 20,
                    width: '100%',
                    maxWidth: '1200px',
                    margin: '0 auto'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={logoImg} alt="BoomRead Logo" style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
                        <div style={{ fontFamily: 'var(--font-logo)', fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.5px' }}>BoomRead</div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <a 
                            href="https://boombooks.shop" 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ 
                                fontSize: '15px', 
                                color: heroColors.text, 
                                fontWeight: 500,
                                transition: 'color 0.3s ease',
                            }} 
                            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.color = heroColors.text; }}
                        >
                            La Boutique
                        </a>
                        <button onClick={() => navigate('/login')} style={{ 
                            background: '#ffffff', 
                            color: '#000000',
                            fontWeight: 600, 
                            padding: '10px 24px', 
                            borderRadius: '12px', 
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '15px',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(255,255,255,0.2)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                            Se Connecter
                        </button>
                    </div>
                </header>

                <div style={{ 
                    position: 'relative', 
                    zIndex: 10, 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    marginTop: '-80px'
                }}>
                    <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <motion.div variants={fadeInUp} style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            padding: '8px 24px', 
                            background: 'rgba(255,215,0,0.1)', 
                            backdropFilter: 'blur(10px)',
                            borderRadius: '24px', 
                            border: '1px solid rgba(255,215,0,0.3)', 
                            color: 'var(--color-primary)', 
                            fontSize: '14px', 
                            fontWeight: 600, 
                            marginBottom: 'var(--space-8)',
                        }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bolt</span>
                            Nouveau : Mode hors-ligne disponible ✨
                        </motion.div>

                        <motion.h1 variants={fadeInUp} style={{ 
                            fontFamily: 'var(--font-slogan)', 
                            fontSize: 'clamp(44px, 8vw, 84px)', 
                            lineHeight: 1.1, 
                            fontWeight: 800,
                            color: '#FFFFFF',
                            marginBottom: 'var(--space-6)',
                        }}>
                            Vos livres BoomBooks,<br/>
                            <span style={{ color: 'var(--color-primary)' }}>partout avec vous.</span>
                        </motion.h1>

                        <motion.p variants={fadeInUp} style={{ 
                            fontSize: 'clamp(18px, 2vw, 22px)', 
                            color: 'rgba(255,255,255,0.85)', 
                            lineHeight: 1.6,
                            marginBottom: 'var(--space-10)',
                            maxWidth: '650px',
                        }}>
                            L'application officielle conçue exclusivement pour lire vos ouvrages achetés sur BoomBooks. Profitez d'une expérience de lecture premium, fluide et immersive.
                        </motion.p>
                        
                        <motion.button 
                            variants={fadeInUp}
                            onClick={() => navigate('/login')} 
                            style={{ 
                                background: '#000',
                                color: '#FFF',
                                padding: '16px 40px', 
                                fontSize: '18px', 
                                borderRadius: '12px',
                                border: 'none',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            Accéder à l'appli
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </motion.button>
                    </motion.div>
                </div>
            </section>

            {/* DEGRADÉ DE TRANSITION */}
            <div style={{
                height: '60px',
                background: `linear-gradient(to bottom, ${heroColors.bg} 0%, ${lightColors.bg} 100%)`,
                marginTop: '-1px' /* Pour éviter une ligne blanche de pixel */
            }}></div>

            {/* DEBUT DU THEME CLAIR */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: lightColors.bg, marginTop: 0 }}>
                
                {/* 2. SECTION ÉCOSYSTÈME (Inspiration Tribbut : Image à gauche, Texte à droite) */}
                <section style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                    
                    <div className="landing-grid">
                        {/* Côté "Image" (Image générée) */}
                        <motion.div 
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            style={{ 
                                background: lightColors.bgWhite, 
                                borderRadius: '24px',
                                padding: '0',
                                border: `1px solid ${lightColors.border}`,
                                boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: '400px',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <img src={ecosystemImg} alt="BoomBooks Ecosystem" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </motion.div>

                        {/* Côté Texte */}
                        <motion.div 
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={staggerContainer}
                            style={{ paddingRight: '20px' }}
                        >
                            <motion.h2 variants={fadeInUp} style={{ fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 800, color: lightColors.text, marginBottom: '24px', fontFamily: 'var(--font-slogan)', lineHeight: 1.2 }}>
                                L'écosystème parfait.
                            </motion.h2>
                            <motion.p variants={fadeInUp} style={{ color: lightColors.textMuted, fontSize: '18px', lineHeight: 1.6, marginBottom: '32px' }}>
                                De l'achat à la lecture en un clin d'œil. Achetez vos ebooks préférés sur notre boutique en ligne et retrouvez-les instantanément ici.
                            </motion.p>
                            
                            <motion.div variants={staggerContainer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <motion.div variants={fadeInUp} style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '12px 24px', background: lightColors.bgWhite, borderRadius: '100px', border: `1px solid ${lightColors.border}`, alignSelf: 'flex-start', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>search</span>
                                    <span style={{ fontWeight: 500, color: lightColors.text }}>1. Trouvez votre pépite</span>
                                </motion.div>
                                <motion.div variants={fadeInUp} style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '12px 24px', background: lightColors.bgWhite, borderRadius: '100px', border: `1px solid ${lightColors.border}`, alignSelf: 'flex-start', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>library_books</span>
                                    <span style={{ fontWeight: 500, color: lightColors.text }}>2. Lisez instantanément</span>
                                </motion.div>
                            </motion.div>
                            
                            <motion.button 
                                variants={fadeInUp}
                                onClick={() => window.open('https://boombooks.shop', '_blank')} 
                                style={{ 
                                    background: '#000', 
                                    color: '#FFF', 
                                    padding: '16px 32px', 
                                    borderRadius: '12px', 
                                    border: 'none', 
                                    fontWeight: 600, 
                                    marginTop: '40px', 
                                    cursor: 'pointer',
                                    fontSize: '16px'
                                }}
                            >
                                Visiter la boutique
                            </motion.button>
                        </motion.div>
                    </div>
                </section>

                {/* 3. SECTION FONCTIONNALITÉS (Inspiration Tribbut : Alternance) */}
                <section style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                    
                    <div className="landing-grid">
                        
                        {/* Côté Texte */}
                        <motion.div 
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={staggerContainer}
                            className="landing-section-2-text"
                            style={{ paddingLeft: '20px' }}
                        >
                            <motion.h2 variants={fadeInUp} style={{ fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 800, color: lightColors.text, marginBottom: '24px', fontFamily: 'var(--font-slogan)', lineHeight: 1.2 }}>
                                Une expérience de lecture Premium.
                            </motion.h2>
                            <motion.p variants={fadeInUp} style={{ color: lightColors.textMuted, fontSize: '18px', lineHeight: 1.6, marginBottom: '32px' }}>
                                Tout a été pensé pour vous offrir le meilleur confort de lecture, où que vous soyez et sur n'importe quel appareil.
                            </motion.p>
                            
                            <motion.div variants={staggerContainer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <motion.div variants={fadeInUp} style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '12px 24px', background: lightColors.bgWhite, borderRadius: '100px', border: `1px solid ${lightColors.border}`, alignSelf: 'flex-start' }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>wifi_off</span>
                                    <span style={{ fontWeight: 500, color: lightColors.text }}>Lecture 100% Hors-Ligne</span>
                                </motion.div>
                                <motion.div variants={fadeInUp} style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '12px 24px', background: lightColors.bgWhite, borderRadius: '100px', border: `1px solid ${lightColors.border}`, alignSelf: 'flex-start' }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>devices</span>
                                    <span style={{ fontWeight: 500, color: lightColors.text }}>Synchronisation Multi-Plateformes</span>
                                </motion.div>
                                <motion.div variants={fadeInUp} style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '12px 24px', background: lightColors.bgWhite, borderRadius: '100px', border: `1px solid ${lightColors.border}`, alignSelf: 'flex-start' }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>record_voice_over</span>
                                    <span style={{ fontWeight: 500, color: lightColors.text }}>Voix IA Ultra-Réalistes</span>
                                </motion.div>
                            </motion.div>

                            <motion.button 
                                variants={fadeInUp}
                                onClick={() => navigate('/login')} 
                                style={{ 
                                    background: '#000', 
                                    color: '#FFF', 
                                    padding: '16px 32px', 
                                    borderRadius: '12px', 
                                    border: 'none', 
                                    fontWeight: 600, 
                                    marginTop: '40px', 
                                    cursor: 'pointer',
                                    fontSize: '16px'
                                }}
                            >
                                Commencer maintenant
                            </motion.button>
                        </motion.div>

                        {/* Côté "Image" */}
                        <motion.div 
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            className="landing-section-2-img"
                            style={{ 
                                background: lightColors.bgWhite, 
                                borderRadius: '24px',
                                padding: '0',
                                border: `1px solid ${lightColors.border}`,
                                boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: '400px',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <img src={premiumImg} alt="Premium Reading" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </motion.div>
                    </div>
                </section>
                
                {/* 4. SECTION CTA / FORM (Inspiration Tribbut : Box centrale) */}
                <section style={{ padding: '80px 24px 120px 24px', maxWidth: '800px', margin: '0 auto', width: '100%', textAlign: 'center' }}>
                    <div style={{ 
                        background: lightColors.bgWhite, 
                        borderRadius: '24px', 
                        padding: '60px 40px', 
                        boxShadow: '0 20px 40px rgba(0,0,0,0.03)',
                        border: `1px solid ${lightColors.border}`
                    }}>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, marginBottom: '16px', color: lightColors.text, fontFamily: 'var(--font-slogan)' }}>
                            Rejoignez l'expérience sans engagement.
                        </h2>
                        <p style={{ color: lightColors.textMuted, fontSize: '18px', marginBottom: '40px' }}>
                            Créez votre compte gratuitement et découvrez une nouvelle façon de lire et d'interagir avec vos livres.
                        </p>
                        
                        <button 
                            onClick={() => navigate('/login')} 
                            style={{ 
                                background: '#FF3B30', // Bouton d'action rouge ou noir
                                background: '#000',
                                color: '#FFF',
                                padding: '18px 48px', 
                                fontSize: '18px', 
                                borderRadius: '12px',
                                border: 'none',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            S'inscrire gratuitement
                        </button>
                    </div>
                </section>
            </main>

            {/* Footer (Thème clair) */}
            <footer style={{ padding: '60px 24px 40px 24px', textAlign: 'center', borderTop: `1px solid ${lightColors.border}`, background: lightColors.bgWhite }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <span style={{ fontFamily: 'var(--font-logo)', fontSize: '24px', fontWeight: 800, color: lightColors.text }}>BoomRead</span>
                    <span style={{ color: lightColors.textMuted }}>&times;</span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: lightColors.text }}>BoomBooks</span>
                </div>
                <p style={{ color: lightColors.textMuted, fontSize: '15px' }}>&copy; {new Date().getFullYear()} BoomRead App. L'application officielle de BoomBooks.</p>
            </footer>
        </div>
    );
}
