import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
    const navigate = useNavigate();
    const [isInstallable, setIsInstallable] = useState(!!window.deferredPrompt);

    useEffect(() => {
        const handleInstallable = () => setIsInstallable(true);
        window.addEventListener('app-installable', handleInstallable);
        return () => window.removeEventListener('app-installable', handleInstallable);
    }, []);

    const handleInstallApp = async () => {
        const promptEvent = window.deferredPrompt;
        if (!promptEvent) return;
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
            setIsInstallable(false);
            window.deferredPrompt = null;
        }
    };

    return (
        <div>
            {/* Install App Banner */}
            {isInstallable && (
                <div style={{ background: 'var(--color-primary)', color: '#000', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-md)' }}>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Télécharger l'App</h3>
                        <p style={{ fontSize: 12, opacity: 0.8 }}>Pour lire hors-ligne</p>
                    </div>
                    <button onClick={handleInstallApp} style={{ background: '#000', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Installer
                    </button>
                </div>
            )}

            {/* Search Bar */}
            <div className="search-bar">
                <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>search</span>
                <input type="text" placeholder="Search books, authors, categories..." />
            </div>

            {/* Continue Reading */}
            <div className="section-header">
                <h2 className="section-title">Continue Reading</h2>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-8)' }} onClick={() => navigate('/reader/mock')}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-6) 0', background: 'var(--color-bg-dark)' }}>
                    <div style={{ width: 120, height: 180, background: '#1a1a1a', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)' }}>
                        <img src="https://images.unsplash.com/photo-1592496431122-2349e0fbc666?q=80&w=300&auto=format&fit=crop" alt="Book cover" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                    </div>
                </div>
                <div style={{ padding: 'var(--space-4)' }}>
                    <p style={{ color: 'var(--color-primary)', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Chapter 4</p>
                    <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 4 }}>The Psychology of Money</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>Morgan Housel</p>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                        <span>42% Completed</span>
                        <span>3h 15m left</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: '42%', height: '100%', background: 'var(--color-primary)' }}></div>
                    </div>
                </div>
            </div>

            {/* Explore Categories */}
            <div className="section-header">
                <h2 className="section-title">Explore Categories</h2>
            </div>
            <div className="horizontal-scroll" style={{ marginBottom: 'var(--space-8)' }}>
                <button className="chip">Business</button>
                <button className="chip">Technology</button>
                <button className="chip">Biography</button>
                <button className="chip">Self-Help</button>
                <button className="chip">Fiction</button>
            </div>

            {/* Curated Collection */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: 'var(--space-6)', marginBottom: 'var(--space-8)', border: 'none' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
                    <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=600&auto=format&fit=crop" alt="Bg" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, rgba(18,18,18,0) 0%, rgba(18,18,18,1) 100%)' }}></div>
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p style={{ color: 'var(--color-primary)', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Curated Collection</p>
                    <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, lineHeight: 1.1, marginBottom: 'var(--space-4)' }}>Motivation,<br/>Business &<br/>Finance</h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)', maxWidth: '90%' }}>Build your empire. Read the defining texts that shape modern wealth and leadership.</p>
                    <button className="btn btn-primary" style={{ borderRadius: 'var(--radius-md)' }}>Explore Collection</button>
                </div>
            </div>

            {/* Trending Now */}
            <div className="section-header">
                <h2 className="section-title">Trending Now</h2>
                <button className="section-link">See all <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span></button>
            </div>
            <div className="horizontal-scroll">
                {[
                    { title: "Atomic Habits", author: "James Clear", img: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop" },
                    { title: "Deep Work", author: "Cal Newport", img: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=300&auto=format&fit=crop" },
                    { title: "Zero to One", author: "Peter Thiel", img: "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=300&auto=format&fit=crop" }
                ].map((book, i) => (
                    <div key={i} style={{ minWidth: 140, width: 140 }}>
                        <div style={{ width: '100%', height: 200, background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', marginBottom: 12, overflow: 'hidden' }}>
                            <img src={book.img} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <h4 className="line-clamp-1" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{book.title}</h4>
                        <p className="line-clamp-1" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{book.author}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
