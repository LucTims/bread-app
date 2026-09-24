import { useNavigate } from 'react-router-dom';
import { ArrowLeft2, Global, Lock, UserEdit, Logout, ArrowRight2 } from 'iconsax-react';
import { useAuth } from '../lib/AuthContext';

export default function Settings() {
    const { signOut } = useAuth();
    const navigate = useNavigate();

    return (
        <div style={{ paddingBottom: 'var(--space-8)' }}>
            <div style={{ marginTop: 2, marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                    onClick={() => navigate(-1)}
                    aria-label="Retour"
                    style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--color-bg-dark)', border: 'none', cursor: 'pointer'
                    }}
                >
                    <ArrowLeft2 size={16} color="var(--color-text)" variant="Linear" />
                </button>
                <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Paramètres</h1>
            </div>

            <h4 style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', textTransform: 'uppercase' }}>Preferences</h4>
            
            <div className="card" style={{ padding: 0, marginBottom: 'var(--space-8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-5)' }}>
                    <Global size={20} color="var(--color-text-muted)" variant="Linear" style={{ marginRight: 'var(--space-4)' }} />
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Language Selection</h4>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>English (US)</p>
                    </div>
                    <ArrowRight2 size={20} color="var(--color-text-muted)" variant="Linear" />
                </div>
            </div>

            <h4 style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', textTransform: 'uppercase' }}>Account & Security</h4>
            
            <div className="card" style={{ padding: 0, marginBottom: 'var(--space-12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border)' }}>
                    <Lock size={20} color="var(--color-text-muted)" variant="Linear" style={{ marginRight: 'var(--space-4)' }} />
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Security Settings</h4>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Password, 2FA, connected devices</p>
                    </div>
                    <ArrowRight2 size={20} color="var(--color-text-muted)" variant="Linear" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-5)' }}>
                    <UserEdit size={20} color="var(--color-text-muted)" variant="Linear" style={{ marginRight: 'var(--space-4)' }} />
                    <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Account Management</h4>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Personal info, subscription details</p>
                    </div>
                    <ArrowRight2 size={20} color="var(--color-text-muted)" variant="Linear" />
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button style={{ 
                    width: '100%', 
                    padding: '16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer'
                }} onClick={signOut}>
                    <Logout size={20} color="var(--color-danger)" variant="Linear" style={{ marginRight: 12 }} />
                    <span style={{ color: 'var(--color-danger)', fontWeight: 600, letterSpacing: 0.5, fontSize: 16 }}>Sign Out</span>
                </button>
            </div>
        </div>
    );
}
