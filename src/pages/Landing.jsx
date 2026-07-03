import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import heroVideo from '../assets/animation/ChengYiUniverse888_pindown.io_1781629419.mp4';

// Configuration des animations
const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.2
        }
    }
};

const scaleUp = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut" } }
};

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
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}><div className="spinner"></div></div>;
    }

    // Nous forçons un thème sombre pour la Landing Page afin de garantir un look "Premium"
    const darkThemeColors = {
        bg: '#0a0a0a',
        bgDark: '#000000',
        text: '#f3f4f6',
        textMuted: '#9ca3af',
        surface: 'rgba(255, 255, 255, 0.03)',
        border: 'rgba(255, 255, 255, 0.08)'
    };

    return (
        <div style={{ minHeight: '100vh', background: darkThemeColors.bg, color: darkThemeColors.text, display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
            
            {/* 1. SECTION HERO (Vidéo Plein Écran) */}
            <section style={{ 
                position: 'relative',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Vidéo de fond */}
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
                        opacity: 0.8
                    }}
                />
                
                {/* Dégradé de superposition */}
                <div style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    background: `linear-gradient(to bottom, rgba(10, 10, 10, 0.3) 0%, rgba(10, 10, 10, 0.8) 70%, ${darkThemeColors.bg} 100%)`, 
                    zIndex: 1 
                }} />

                {/* Header / Nav */}
                <header style={{ 
                    padding: 'var(--space-4) var(--space-6)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    position: 'relative', 
                    zIndex: 20, // Z-index augmenté à 20 pour être au-dessus du main content (-80px margin)
                    width: '100%',
                    maxWidth: 'var(--container-max)',
                    margin: '0 auto'
                }}>
                    <div style={{ fontFamily: 'var(--font-logo)', fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.5px' }}>BRead</div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {/* BOUTON BOOMBOOKS AMÉLIORÉ (Plus compact) */}
                        <a 
                            href="https://boombooks.shop" 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ 
                                fontSize: '13px', 
                                color: darkThemeColors.text, 
                                fontWeight: 600, 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                padding: '6px 12px',
                                background: 'rgba(255,255,255,0.1)',
                                backdropFilter: 'blur(10px)',
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                transition: 'all 0.3s ease',
                                whiteSpace: 'nowrap'
                            }} 
                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>storefront</span>
                            La Boutique
                        </a>
                        <button onClick={() => navigate('/login')} className="btn btn-primary btn-sm" style={{ fontWeight: 'bold', padding: '8px 16px', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap', cursor: 'pointer' }}>Se Connecter</button>
                    </div>
                </header>

                {/* Contenu principal du Hero */}
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
                    <motion.div 
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                        style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                    >
                        <motion.div variants={fadeInUp} style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            padding: '8px 20px', 
                            background: 'rgba(255,215,0,0.1)', 
                            backdropFilter: 'blur(10px)',
                            borderRadius: 'var(--radius-full)', 
                            border: '1px solid rgba(255,215,0,0.3)', 
                            color: 'var(--color-primary)', 
                            fontSize: 'var(--text-sm)', 
                            fontWeight: 700, 
                            marginBottom: 'var(--space-6)',
                            boxShadow: '0 4px 12px rgba(255,215,0,0.1)'
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
                            marginBottom: 'var(--space-5)',
                            textShadow: '0 10px 30px rgba(0,0,0,0.8)'
                        }}>
                            Vos livres BoomBooks,<br/>
                            <span style={{ 
                                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>partout avec vous.</span>
                        </motion.h1>

                        <motion.p variants={fadeInUp} style={{ 
                            fontSize: 'clamp(16px, 2vw, 20px)', 
                            color: 'rgba(255,255,255,0.85)', 
                            lineHeight: 1.6,
                            marginBottom: 'var(--space-8)',
                            maxWidth: '600px',
                            textShadow: '0 2px 10px rgba(0,0,0,0.8)'
                        }}>
                            L'application officielle conçue exclusivement pour lire vos ouvrages achetés sur BoomBooks. Profitez d'une expérience de lecture premium, fluide et immersive.
                        </motion.p>
                        
                        <motion.div variants={fadeInUp} style={{ 
                            display: 'flex', 
                            gap: 'var(--space-4)', 
                            flexWrap: 'wrap', 
                            justifyContent: 'center',
                            width: '100%'
                        }}>
                            <motion.button 
                                whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(255,215,0,0.4)' }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate('/login')} 
                                className="btn btn-primary btn-lg" 
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 32px', fontSize: '18px', borderRadius: 'var(--radius-full)' }}
                            >
                                Accéder à l'appli
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </motion.button>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* 2. SECTION COMMENT ÇA MARCHE */}
                <section style={{ padding: 'var(--space-16) var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                    
                    <div style={{ marginBottom: 'var(--space-10)' }}>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: '#FFFFFF' }}>L'écosystème parfait</h2>
                        <p style={{ color: darkThemeColors.textMuted, fontSize: '18px', marginTop: '8px' }}>De l'achat à la lecture en un clin d'œil.</p>
                    </div>

                    <motion.div 
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-100px" }}
                        variants={staggerContainer}
                        style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: 'var(--space-6)', 
                            justifyContent: 'center', 
                            maxWidth: '1000px', 
                            width: '100%', 
                            alignItems: 'center' 
                        }}
                    >
                        {/* Étape 1 */}
                        <motion.div variants={fadeInUp} style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '300px' }}>
                            <motion.div 
                                whileHover={{ y: -5 }}
                                style={{ 
                                    background: 'linear-gradient(145deg, #111111 0%, #0a0a0a 100%)', 
                                    borderRadius: 'var(--radius-2xl)', 
                                    padding: 'var(--space-8)', 
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)', 
                                    border: `1px solid ${darkThemeColors.border}`, 
                                    transition: 'all 0.4s ease',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                {/* Effet de lueur */}
                                <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle at center, rgba(100,100,255,0.05) 0%, transparent 50%)', pointerEvents: 'none' }}></div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                                    <h3 style={{ fontSize: '26px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>BoomBooks<span style={{color: '#888'}}>.shop</span></h3>
                                    <p style={{ color: darkThemeColors.textMuted, marginTop: '8px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>La Boutique</p>
                                    
                                    <div style={{ marginTop: '32px', display: 'flex', gap: '16px', alignItems: 'flex-end', height: '80px' }}>
                                        <div style={{ width: '40px', height: '60px', background: 'linear-gradient(to top, #667eea, #764ba2)', borderRadius: '4px', boxShadow: '0 10px 20px rgba(102,126,234,0.3)' }}></div>
                                        <div style={{ width: '48px', height: '72px', background: 'linear-gradient(to top, #f093fb, #f5576c)', borderRadius: '4px', boxShadow: '0 10px 20px rgba(245,87,108,0.3)' }}></div>
                                        <div style={{ width: '40px', height: '60px', background: 'linear-gradient(to top, #4facfe, #00f2fe)', borderRadius: '4px', boxShadow: '0 10px 20px rgba(79,172,254,0.3)' }}></div>
                                    </div>
                                </div>
                            </motion.div>
                            <div>
                                <h4 style={{ fontSize: '22px', fontWeight: 'bold', color: '#FFFFFF' }}>1. Trouvez votre pépite</h4>
                                <p style={{ color: darkThemeColors.textMuted, marginTop: '8px', lineHeight: 1.5 }}>Achetez vos ebooks préférés sur notre boutique en ligne partenaire.</p>
                            </div>
                        </motion.div>
                        
                        {/* Flèche */}
                        <motion.div variants={scaleUp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', padding: '16px' }}>
                            <span className="material-symbols-outlined" style={{ 
                                fontSize: '48px', 
                                transform: window.innerWidth < 768 ? 'rotate(90deg)' : 'rotate(0deg)' 
                            }}>
                                sync_alt
                            </span>
                        </motion.div>
                        
                        {/* Étape 2 */}
                        <motion.div variants={fadeInUp} style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '300px' }}>
                            <motion.div 
                                whileHover={{ y: -5 }}
                                style={{ 
                                    background: 'linear-gradient(145deg, #111111 0%, #0a0a0a 100%)', 
                                    borderRadius: 'var(--radius-2xl)', 
                                    padding: 'var(--space-8)', 
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)', 
                                    border: '1px solid rgba(255,215,0,0.3)', 
                                    transition: 'all 0.4s ease',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                {/* Effet de lueur dorée */}
                                <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle at center, rgba(255,215,0,0.08) 0%, transparent 50%)', pointerEvents: 'none' }}></div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                                    <h3 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-1px', fontFamily: 'var(--font-logo)' }}>BRead</h3>
                                    <p style={{ color: darkThemeColors.textMuted, marginTop: '8px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>L'Application</p>
                                    
                                    <div style={{ marginTop: '48px', marginBottom: '16px', width: '120px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            whileInView={{ width: '75%' }}
                                            transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                                            style={{ height: '100%', background: 'var(--color-primary)', borderRadius: '3px' }}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                            <div>
                                <h4 style={{ fontSize: '22px', fontWeight: 'bold', color: '#FFFFFF' }}>2. Lisez instantanément</h4>
                                <p style={{ color: darkThemeColors.textMuted, marginTop: '8px', lineHeight: 1.5 }}>Connectez-vous à BRead. Vos achats sont synchronisés et prêts à être lus.</p>
                            </div>
                        </motion.div>
                    </motion.div>
                </section>

                {/* 3. SECTION FONCTIONNALITÉS */}
                <section style={{ padding: 'var(--space-16) var(--space-6)', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                    
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: '#FFFFFF' }}>Une expérience de lecture Premium</h2>
                    </div>

                    <motion.div 
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-50px" }}
                        variants={staggerContainer}
                        style={{ 
                            display: 'grid', 
                            gap: 'var(--space-6)', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' 
                        }}
                    >
                        {/* Carte Fonctionnalité 1 */}
                        <motion.div variants={scaleUp} whileHover={{ y: -8 }} style={{ 
                            background: darkThemeColors.surface, 
                            border: `1px solid ${darkThemeColors.border}`, 
                            padding: 'var(--space-8)', 
                            borderRadius: 'var(--radius-2xl)',
                            transition: 'all 0.3s ease' 
                        }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', marginBottom: 'var(--space-5)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>wifi_off</span>
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-3)', color: '#FFFFFF' }}>100% Hors-Ligne</h3>
                            <p style={{ color: darkThemeColors.textMuted, lineHeight: 1.6, fontSize: '15px' }}>Téléchargez vos livres et profitez-en dans l'avion ou le métro, sans aucune connexion internet.</p>
                        </motion.div>

                        {/* Carte Fonctionnalité 2 */}
                        <motion.div variants={scaleUp} whileHover={{ y: -8 }} style={{ 
                            background: darkThemeColors.surface, 
                            border: `1px solid ${darkThemeColors.border}`, 
                            padding: 'var(--space-8)', 
                            borderRadius: 'var(--radius-2xl)',
                            transition: 'all 0.3s ease' 
                        }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', marginBottom: 'var(--space-5)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>devices</span>
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-3)', color: '#FFFFFF' }}>Multi-Plateformes</h3>
                            <p style={{ color: darkThemeColors.textMuted, lineHeight: 1.6, fontSize: '15px' }}>Installez l'app sur téléphone, tablette ou PC. Reprenez votre lecture exactement où vous l'avez laissée.</p>
                        </motion.div>

                        {/* Carte Fonctionnalité 3 */}
                        <motion.div variants={scaleUp} whileHover={{ y: -8 }} style={{ 
                            background: darkThemeColors.surface, 
                            border: `1px solid ${darkThemeColors.border}`, 
                            padding: 'var(--space-8)', 
                            borderRadius: 'var(--radius-2xl)',
                            transition: 'all 0.3s ease' 
                        }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,165,0,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: 'var(--space-5)', border: '1px solid rgba(255,215,0,0.2)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>record_voice_over</span>
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-3)', color: '#FFFFFF' }}>Voix IA Ultra-Réalistes</h3>
                            <p style={{ color: darkThemeColors.textMuted, lineHeight: 1.6, fontSize: '15px' }}>Fermez les yeux et écoutez. L'IA lit vos livres avec une intonation humaine parfaite grâce à ElevenLabs.</p>
                        </motion.div>
                    </motion.div>
                </section>
                
                {/* 4. SECTION CTA */}
                <motion.section 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1 }}
                    style={{ 
                        padding: 'var(--space-20) var(--space-6)', 
                        textAlign: 'center', 
                        background: `linear-gradient(to top, rgba(255,215,0,0.03) 0%, ${darkThemeColors.bg} 100%)`,
                        borderTop: `1px solid ${darkThemeColors.border}`
                    }}
                >
                    <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, marginBottom: 'var(--space-6)', color: '#FFFFFF' }}>Prêt à plonger ?</h2>
                    <motion.button 
                        whileHover={{ scale: 1.05, boxShadow: '0 10px 40px rgba(255,215,0,0.4)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/login')} 
                        className="btn btn-primary btn-lg" 
                        style={{ padding: '18px 48px', fontSize: '20px', borderRadius: 'var(--radius-full)', fontWeight: 800 }}
                    >
                        Ouvrir BRead
                    </motion.button>
                </motion.section>
            </main>

            {/* Footer */}
            <footer style={{ padding: 'var(--space-10) var(--space-6)', textAlign: 'center', borderTop: `1px solid ${darkThemeColors.border}`, background: darkThemeColors.bgDark }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-4)' }}>
                    <span style={{ fontFamily: 'var(--font-logo)', fontSize: '24px', fontWeight: 800, color: darkThemeColors.text }}>BRead</span>
                    <span style={{ color: darkThemeColors.textMuted }}>&times;</span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: darkThemeColors.text }}>BoomBooks</span>
                </div>
                <p style={{ color: darkThemeColors.textMuted, fontSize: '14px' }}>&copy; {new Date().getFullYear()} BRead App. L'application officielle de BoomBooks.</p>
            </footer>
        </div>
    );
}

