import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HambergerMenu, SearchNormal1, Notification, SecurityUser, Setting2, Shop } from 'iconsax-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import useOnlineStatus from '../lib/useOnlineStatus';

const MENU_ICONS = { admin_panel_settings: SecurityUser, settings: Setting2, storefront: Shop };

export default function TopBar({ minimal = false }) {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { isOnline } = useOnlineStatus();
    const [menuOpen, setMenuOpen] = useState(false);
    const [streak, setStreak] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const menuRef = useRef(null);

    useEffect(() => {
        if (user && isOnline) {
            supabase.from('profiles').select('current_streak').eq('id', user.id).single()
                .then(({ data }) => {
                    if (data && data.current_streak) setStreak(data.current_streak);
                }).catch(() => {});
        }
    }, [user, isOnline]);

    useEffect(() => {
        if (!user) return;
        async function fetchUnread() {
            try {
                const { count: totalCount } = await supabase.from('notifications').select('id', { count: 'exact', head: true });
                const { count: readCount } = await supabase.from('notification_reads').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
                setUnreadCount(Math.max(0, (totalCount || 0) - (readCount || 0)));
            } catch (err) {
                console.error('[TopBar] Unread count error:', err);
            }
        }
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, [user]);
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    const initial = (user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase();

    // Build menu items list
    const menuItems = [];
    if (profile?.role === 'admin') {
        menuItems.push({ icon: 'admin_panel_settings', label: 'Console Admin 🛠️', action: () => navigate('/admin') });
    }
    menuItems.push(
        { icon: 'settings', label: 'Paramètres', action: () => navigate('/settings') },
        { icon: 'storefront', label: 'BoomBooks.shop', action: () => window.open('https://boombooks.shop', '_blank') }
    );

    return (
        <>
            {/* ── Header ── */}
            <header style={{ 
                padding: '0 var(--space-4)', 
                background: 'var(--color-bg)', 
                position: 'fixed', 
                top: 0, 
                left: 0, width: '100%', zIndex: 50, 
                height: 'var(--header-height)',
                display: 'flex', alignItems: 'center', justifyContent: minimal ? 'flex-end' : 'space-between',
                borderBottom: minimal ? 'none' : '1px solid var(--color-border)',
                transition: 'top 0.3s ease'
            }}>
                {!minimal && (
                    <div style={{ position: 'relative' }} ref={menuRef}>
                        <button className="btn-ghost" style={{ padding: 4, borderRadius: 4 }} onClick={() => setMenuOpen(!menuOpen)}>
                            <HambergerMenu size={22} color="currentColor" variant="Linear" />
                        </button>

                        {menuOpen && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, marginTop: 8,
                                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                                minWidth: 220, zIndex: 100, overflow: 'hidden'
                            }}>
                                {menuItems.map((item, i) => {
                                    const ItemIcon = MENU_ICONS[item.icon];
                                    return (
                                        <div key={i}
                                            style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                                            onClick={() => { setMenuOpen(false); item.action(); }}
                                        >
                                            {ItemIcon && <ItemIcon size={20} color="var(--color-text-muted)" variant="Linear" />}
                                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{item.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {!minimal && (
                    <h1 style={{ fontFamily: 'var(--font-logo)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)' }}>BoomRead</h1>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {!minimal && streak > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--color-primary-light)', padding: '4px 8px', borderRadius: 12, border: '1px solid var(--color-primary-light)' }} onClick={() => navigate('/profile')}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-primary-text)' }}>local_fire_department</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-text)' }}>{streak}</span>
                        </div>
                    )}
                    {!minimal && (
                        <button className="btn-ghost" style={{ padding: 6, borderRadius: '50%', color: 'var(--color-text)' }} onClick={() => navigate('/search')}>
                            <SearchNormal1 size={22} color="currentColor" variant="Linear" />
                        </button>
                    )}
                    <div onClick={() => navigate('/notifications')} style={{
                        width: 36, height: 36, borderRadius: '50%', background: 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative'
                    }}>
                        <Notification size={26} color="var(--color-text)" variant="Linear" />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute', top: 4, right: 2,
                                minWidth: 16, height: 16, borderRadius: 8,
                                background: 'var(--color-danger)', color: '#fff', fontSize: 10, fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 4px', boxShadow: '0 1px 4px rgba(220,38,38,0.4)', lineHeight: 1
                            }}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
}
