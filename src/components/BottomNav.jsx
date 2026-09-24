import { NavLink } from 'react-router-dom';
import { Home, Book, MessageCircle, User } from 'iconsax-react';
import { useChat } from '../lib/ChatContext';

export default function BottomNav() {
    const { unreadCount: unreadChatCount } = useChat();

    return (
        <nav className="bottom-nav">
            <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
                {({ isActive }) => (
                    <>
                        <Home size={22} color="currentColor" variant={isActive ? 'Bold' : 'Linear'} />
                        Accueil
                    </>
                )}
            </NavLink>
            <NavLink to="/library" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                {({ isActive }) => (
                    <>
                        <Book size={22} color="currentColor" variant={isActive ? 'Bold' : 'Linear'} />
                        Livres
                    </>
                )}
            </NavLink>
            <NavLink to="/chat" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
                {({ isActive }) => (
                    <>
                        <MessageCircle size={22} color="currentColor" variant={isActive ? 'Bold' : 'Linear'} />
                        {unreadChatCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: 6,
                                right: '50%',
                                transform: 'translateX(10px)',
                                minWidth: 10, height: 10,
                                borderRadius: 5,
                                background: 'var(--color-danger)',
                                boxShadow: '0 1px 4px rgba(220,38,38,0.4)',
                            }} />
                        )}
                        Chat
                    </>
                )}
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                {({ isActive }) => (
                    <>
                        <User size={22} color="currentColor" variant={isActive ? 'Bold' : 'Linear'} />
                        Profil
                    </>
                )}
            </NavLink>
        </nav>
    );
}
