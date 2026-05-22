import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function BottomNav() {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        async function fetchUnread() {
            try {
                // Get total notifications count
                const { count: totalCount } = await supabase
                    .from('notifications')
                    .select('id', { count: 'exact', head: true });

                // Get read count for this user
                const { count: readCount } = await supabase
                    .from('notification_reads')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                setUnreadCount(Math.max(0, (totalCount || 0) - (readCount || 0)));
            } catch (err) {
                console.error('[BottomNav] Unread count error:', err);
            }
        }

        fetchUnread();

        // Refresh every 30 seconds
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, [user]);

    return (
        <nav className="bottom-nav">
            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
                <span className="material-symbols-outlined">home</span>
                Home
            </NavLink>
            <NavLink to="/library" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="material-symbols-outlined">library_books</span>
                Library
            </NavLink>
            <NavLink to="/search" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="material-symbols-outlined">search</span>
                Search
            </NavLink>
            <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: 4,
                        right: '50%',
                        transform: 'translateX(12px)',
                        minWidth: 16, height: 16,
                        borderRadius: 8,
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                        boxShadow: '0 1px 4px rgba(239,68,68,0.4)',
                        lineHeight: 1
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
                Notifications
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="material-symbols-outlined">person</span>
                Profile
            </NavLink>
        </nav>
    );
}
