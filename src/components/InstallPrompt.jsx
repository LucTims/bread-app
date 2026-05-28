import { useState, useEffect, useCallback } from 'react';

// ── Shared install state ──
// The beforeinstallprompt can fire BEFORE React loads (captured in index.html)
// or AFTER. We track both cases with a reactive listener pattern.

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

/**
 * Hook that returns the current install prompt (or null).
 * Re-renders the component when the prompt becomes available.
 */
function useInstallPrompt() {
    const [prompt, setPrompt] = useState(window.deferredPrompt || null);

    useEffect(() => {
        // Listen for the event in case it fires after mount
        const handlePrompt = (e) => {
            e.preventDefault();
            window.deferredPrompt = e;
            setPrompt(e);
        };

        // Listen for our custom event (dispatched from index.html capture)
        const handleInstallable = () => {
            setPrompt(window.deferredPrompt);
        };

        const handleInstalled = () => {
            window.deferredPrompt = null;
            setPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handlePrompt);
        window.addEventListener('app-installable', handleInstallable);
        window.addEventListener('appinstalled', handleInstalled);

        // Also check if it was already captured before this component mounted
        if (window.deferredPrompt && !prompt) {
            setPrompt(window.deferredPrompt);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handlePrompt);
            window.removeEventListener('app-installable', handleInstallable);
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, []);

    return prompt;
}

/**
 * Trigger the native browser install prompt.
 * Returns true if the prompt was shown, false otherwise.
 */
async function triggerNativeInstall(deferredPrompt) {
    if (!deferredPrompt) return false;
    try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            window.deferredPrompt = null;
        }
        return true;
    } catch (err) {
        console.warn('[Install] Prompt error:', err);
        return false;
    }
}

// ─── Install Help Modal (iOS / fallback) ───
function InstallHelpModal({ isOpen, onClose }) {
    if (!isOpen) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface, #1a1a2e)', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>📲 Installer BRead</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {isIOS ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Step n="1">Appuyez sur <strong>Partager</strong> <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>ios_share</span> en bas de Safari</Step>
                        <Step n="2">Faites défiler et appuyez sur <strong>"Sur l'écran d'accueil"</strong> <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>add_box</span></Step>
                        <Step n="3">Appuyez sur <strong>"Ajouter"</strong></Step>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Step n="1">Appuyez sur le menu <strong>⋮</strong> en haut à droite du navigateur</Step>
                        <Step n="2">Appuyez sur <strong>"Installer l'application"</strong> ou <strong>"Ajouter à l'écran d'accueil"</strong></Step>
                    </div>
                )}

                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 20, lineHeight: 1.5, textAlign: 'center' }}>
                    L'application sera ajoutée à votre écran d'accueil pour un accès rapide et la lecture hors-ligne.
                </p>
            </div>
        </div>
    );
}

function Step({ n, children }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,215,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 16, color: 'var(--color-primary)' }}>
                {n}
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.4 }}>{children}</p>
        </div>
    );
}

// ─── Banner (fixed top bar, used on Login) ───
export function InstallBanner() {
    const deferredPrompt = useInstallPrompt();
    const [showHelp, setShowHelp] = useState(false);
    if (isStandalone) return null;

    const handleClick = async () => {
        const shown = await triggerNativeInstall(deferredPrompt);
        if (!shown) setShowHelp(true);
    };

    return (
        <>
            <div onClick={handleClick} style={{
                background: 'linear-gradient(135deg, #FFD700, #FFA000)',
                padding: '12px 16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 2px 12px rgba(255,215,0,0.3)'
            }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#000' }}>install_mobile</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#000' }}>Installer l'App pour lire hors-ligne</span>
                <span style={{ background: '#000', color: '#FFD700', padding: '4px 12px', borderRadius: 14, fontSize: 11, fontWeight: 700, marginLeft: 4 }}>Installer</span>
            </div>
            <InstallHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
        </>
    );
}

// ─── Card button (for Home, Profile) ───
export function InstallButton({ style }) {
    const deferredPrompt = useInstallPrompt();
    const [showHelp, setShowHelp] = useState(false);
    if (isStandalone) return null;

    const handleClick = async () => {
        const shown = await triggerNativeInstall(deferredPrompt);
        if (!shown) setShowHelp(true);
    };

    return (
        <>
            <div className="card" onClick={handleClick} style={{
                padding: 'var(--space-5, 20px)', display: 'flex', alignItems: 'center', cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,160,0,0.08))',
                border: '1px solid rgba(255,215,0,0.2)', ...style
            }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #FFA000)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                    <span className="material-symbols-outlined" style={{ color: '#000', fontSize: 20 }}>install_mobile</span>
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700 }}>Installer l'application</h4>
                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Lire hors-ligne sur votre appareil</p>
                </div>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>download</span>
            </div>
            <InstallHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
        </>
    );
}

// ─── Menu item (for hamburger menu) ───
export function InstallMenuItem({ onClick }) {
    const deferredPrompt = useInstallPrompt();
    const [showHelp, setShowHelp] = useState(false);
    if (isStandalone) return null;

    const handleClick = async () => {
        if (onClick) onClick();
        const shown = await triggerNativeInstall(deferredPrompt);
        if (!shown) setShowHelp(true);
    };

    return (
        <>
            <div style={{
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
                background: 'linear-gradient(135deg, rgba(255,215,0,0.06), transparent)'
            }} onClick={handleClick}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-primary)' }}>install_mobile</span>
                <span style={{ fontSize: 'var(--text-sm, 14px)', fontWeight: 600, color: 'var(--color-primary)' }}>Installer l'App</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--color-primary)', color: '#000', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>GRATUIT</span>
            </div>
            <InstallHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
        </>
    );
}
