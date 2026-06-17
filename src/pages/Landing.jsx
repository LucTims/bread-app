import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import heroVideo from '../assets/animation/ChengYiUniverse888_pindown.io_1781629419.mp4';

// Configuration des animations
const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15
        }
    }
};

const scaleUp = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } }
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
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner"></div></div>;
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
            {/* Header / Nav */}
            <header style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontFamily: 'var(--font-logo)', fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.5px' }}>BRead</div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <a href="https://boombooks.shop" target="_blank" rel="noreferrer" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }} className="hide-on-mobile login-link-muted">Aller sur BoomBooks</a>
                    <button onClick={() => navigate('/login')} className="btn btn-primary btn-sm" style={{ fontWeight: 'bold' }}>Se Connecter</button>
                </div>
            </header>

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Hero Section */}
                <section style={{ 
                    padding: 'clamp(40px, 10vh, 100px) var(--space-6)', 
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Background glows */}
                    <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '500px', height: '500px', background: 'rgba(255,215,0,0.08)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '400px', height: '400px', background: 'rgba(245,158,11,0.06)', filter: 'blur(100px)', borderRadius: '50%', pointerEvents: 'none' }} />

                    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-8)' }}>
                        {/* Text Column */}
                        <motion.div 
                            style={{ flex: '1 1 500px', zIndex: 10 }}
                            variants={staggerContainer}
                            initial="hidden"
                            animate="visible"
                        >
                            <motion.div variants={fadeInUp} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(255,215,0,0.1)', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,215,0,0.2)', color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bolt</span>
                                Nouveau : Mode hors-ligne disponible ✨
                            </motion.div>

                            <motion.h1 variants={fadeInUp} style={{ 
                                fontFamily: 'var(--font-slogan)', 
                                fontSize: 'clamp(40px, 6vw, 72px)', 
                                lineHeight: 1.1, 
                                fontWeight: 800,
                                color: '#FFF',
                                marginBottom: 'var(--space-4)',
                            }}>
                                Vos livres BoomBooks,<br/>
                                <span style={{ 
                                    background: 'linear-gradient(135deg, #FFD700 0%, #F59E0B 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}>partout avec vous.</span>
                            </motion.h1>

                            <motion.p variants={fadeInUp} style={{ 
                                fontSize: 'clamp(16px, 1.5vw, 18px)', 
                                color: 'var(--color-text-muted)', 
                                lineHeight: 1.6,
                                marginBottom: 'var(--space-6)',
                                maxWidth: '540px'
                            }}>
                                L'application officielle conçue exclusivement pour lire vos ouvrages achetés sur BoomBooks. Profitez d'une expérience de lecture premium, fluide et immersive.
                            </motion.p>
                            
                            <motion.div variants={fadeInUp} style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                                <motion.button 
                                    whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(255,215,0,0.3)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => window.open('https://boombooks.shop', '_blank')} 
                                    className="btn btn-primary btn-lg" 
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 28px', fontSize: '16px' }}
                                >
                                    <span className="material-symbols-outlined">shopping_bag</span>
                                    Acheter des livres
                                </motion.button>
                                <motion.button 
                                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.05)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => navigate('/login')} 
                                    className="btn btn-outline btn-lg" 
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 28px', fontSize: '16px', border: '1px solid rgba(255,255,255,0.2)' }}
                                >
                                    Accéder à l'appli
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </motion.button>
                            </motion.div>
                        </motion.div>

                        {/* Video / Graphic Column */}
                        <motion.div 
                            style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 10 }}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                        >
                            {/* Glassmorphic Frame */}
                            <motion.div 
                                animate={{ y: [0, -15, 0] }}
                                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                                style={{ 
                                    position: 'relative',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '32px',
                                    padding: '12px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                                    backdropFilter: 'blur(20px)',
                                    maxWidth: '320px',
                                    width: '100%'
                                }}
                            >
                                <div style={{ 
                                    borderRadius: '24px', 
                                    overflow: 'hidden', 
                                    background: '#000',
                                    position: 'relative',
                                    aspectRatio: '9/16'
                                }}>
                                    <video 
                                        src={heroVideo} 
                                        autoPlay 
                                        loop 
                                        muted 
                                        playsInline
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    {/* Reflection highlight */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, transparent 100%)', pointerEvents: 'none' }} />
                                </div>
                            </motion.div>
                            
                            {/* Decorative floating elements */}
                            <motion.div 
                                animate={{ y: [0, 20, 0], rotate: [0, 10, 0] }}
                                transition={{ repeat: Infinity, duration: 8, ease: "easeInOut", delay: 1 }}
                                style={{ position: 'absolute', bottom: '10%', left: '-10%', width: '80px', height: '80px', background: 'rgba(255,215,0,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: '20px', transform: 'rotate(-15deg)', zIndex: 5 }}
                            />
                            <motion.div 
                                animate={{ y: [0, -25, 0], rotate: [0, -15, 0] }}
                                transition={{ repeat: Infinity, duration: 7, ease: "easeInOut", delay: 2 }}
                                style={{ position: 'absolute', top: '20%', right: '-5%', width: '60px', height: '60px', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', zIndex: 15 }}
                            />
                        </motion.div>
                    </div>
                </section>

                {/* Visual / Connection Section */}
                <section style={{ padding: 'var(--space-12) var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                    <motion.div 
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-100px" }}
                        variants={staggerContainer}
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)', justifyContent: 'center', maxWidth: '1000px', width: '100%', alignItems: 'center' }}
                    >
                        <motion.div variants={fadeInUp} style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <motion.div 
                                whileHover={{ scale: 1.02, rotateY: 0 }}
                                style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-2)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', transform: 'perspective(1000px) rotateY(5deg)', transition: 'transform 0.4s ease' }}
                            >
                                <div style={{ background: 'var(--color-bg-dark)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <h3 style={{ fontSize: '32px', fontWeight: 800, color: '#FFF', letterSpacing: '-1px' }}>BoomBooks.shop</h3>
                                    <p style={{ color: 'var(--color-text-muted)', marginTop: '8px' }}>La boutique officielle</p>
                                    <div style={{ marginTop: '24px', display: 'flex', gap: '8px' }}>
                                        <div style={{ width: '40px', height: '60px', background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: '4px' }}></div>
                                        <div style={{ width: '40px', height: '60px', background: 'linear-gradient(135deg, #f093fb, #f5576c)', borderRadius: '4px' }}></div>
                                        <div style={{ width: '40px', height: '60px', background: 'linear-gradient(135deg, #4facfe, #00f2fe)', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                            </motion.div>
                            <h4 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold' }}>1. Achetez vos livres</h4>
                            <p style={{ color: 'var(--color-text-muted)' }}>Trouvez et achetez vos ebooks préférés directement sur notre boutique BoomBooks.shop.</p>
                        </motion.div>
                        
                        <motion.div variants={scaleUp} className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>sync_alt</span>
                        </motion.div>
                        
                        <motion.div variants={fadeInUp} style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <motion.div 
                                whileHover={{ scale: 1.02, rotateY: 0 }}
                                style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-2)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', transform: 'perspective(1000px) rotateY(-5deg)', transition: 'transform 0.4s ease' }}
                            >
                                <div style={{ background: 'var(--color-bg-dark)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(255,215,0,0.1), transparent)', pointerEvents: 'none' }} />
                                    <h3 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-1px', fontFamily: 'var(--font-logo)' }}>BRead</h3>
                                    <p style={{ color: 'var(--color-text-muted)', marginTop: '8px' }}>L'application de lecture</p>
                                    <div style={{ marginTop: '24px', width: '120px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            whileInView={{ width: '60%' }}
                                            transition={{ duration: 1, delay: 0.5 }}
                                            style={{ height: '100%', background: 'var(--color-primary)' }}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                            <h4 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold' }}>2. Lisez en toute fluidité</h4>
                            <p style={{ color: 'var(--color-text-muted)' }}>Ouvrez BRead, vos livres vous y attendent déjà. Profitez d'une liseuse conçue pour vous.</p>
                        </motion.div>
                    </motion.div>
                </section>

                {/* Features Section */}
                <section style={{ padding: 'var(--space-16) var(--space-6)', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                    <motion.div 
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-50px" }}
                        variants={staggerContainer}
                        style={{ display: 'grid', gap: 'var(--space-6)', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
                    >
                        <motion.div variants={scaleUp} whileHover={{ y: -8, backgroundColor: 'rgba(255,255,255,0.05)' }} className="card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', padding: 'var(--space-8)', transition: 'background-color 0.3s ease' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: 'var(--space-4)', border: '1px solid rgba(255,215,0,0.2)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>wifi_off</span>
                            </div>
                            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Lecture 100% Hors-Ligne</h3>
                            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>Téléchargez vos livres sur votre appareil et lisez-les n'importe où : dans l'avion, dans le métro ou en pleine nature, sans aucune connexion.</p>
                        </motion.div>

                        <motion.div variants={scaleUp} whileHover={{ y: -8, backgroundColor: 'rgba(255,255,255,0.05)' }} className="card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', padding: 'var(--space-8)', transition: 'background-color 0.3s ease' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: 'var(--space-4)', border: '1px solid rgba(255,215,0,0.2)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>devices</span>
                            </div>
                            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Multi-Plateformes</h3>
                            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>Installez BRead comme une application native sur votre téléphone, tablette ou ordinateur. Reprenez votre lecture exactement là où vous l'avez laissée.</p>
                        </motion.div>

                        <motion.div variants={scaleUp} whileHover={{ y: -8, backgroundColor: 'rgba(255,255,255,0.05)' }} className="card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', padding: 'var(--space-8)', transition: 'background-color 0.3s ease' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: 'var(--space-4)', border: '1px solid rgba(255,215,0,0.2)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>tune</span>
                            </div>
                            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Liseuse Personnalisable</h3>
                            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>Mode sombre, mode clair, tailles de police ajustables et navigation fluide. BRead s'adapte à vos préférences pour un confort des yeux optimal.</p>
                        </motion.div>
                    </motion.div>
                </section>
                
                {/* CTA Section */}
                <motion.section 
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    style={{ padding: 'var(--space-16) var(--space-6)', textAlign: 'center', background: 'linear-gradient(to top, rgba(255,215,0,0.05) 0%, rgba(0,0,0,0) 100%)' }}
                >
                    <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, marginBottom: 'var(--space-6)' }}>Prêt à plonger dans votre prochain livre ?</h2>
                    <motion.button 
                        whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(255,215,0,0.3)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/login')} 
                        className="btn btn-primary btn-lg" 
                        style={{ padding: '18px 48px', fontSize: '20px', borderRadius: 'var(--radius-full)' }}
                    >
                        Se connecter à BRead
                    </motion.button>
                </motion.section>
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
