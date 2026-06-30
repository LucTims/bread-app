import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useChat } from '../lib/ChatContext';

export default function BottomNav() {
    const { user } = useAuth();
    const { unreadCount: unreadChatCount } = useChat();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        // La logique des notifications a été déplacée dans TopBar
    }, [user]);
    return (
        <nav className="bottom-nav">
            <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
                <span className="material-symbols-outlined">home</span>
                Home
            </NavLink>
            <NavLink to="/library" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="material-symbols-outlined">library_books</span>
                Library
            </NavLink>
            <NavLink to="/chat" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
                <span className="material-symbols-outlined">forum</span>
                {unreadChatCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: 6,
                        right: '50%',
                        transform: 'translateX(10px)',
                        minWidth: 10, height: 10,
                        borderRadius: 5,
                        background: '#ef4444',
                        boxShadow: '0 1px 4px rgba(239,68,68,0.4)',
                    }} />
                )}
                Chat
            </NavLink>
            <NavLink to="/local-books" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="material-symbols-outlined">folder</span>
                Local
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="material-symbols-outlined">person</span>
                Profile
            </NavLink>
        </nav>
    );
}
