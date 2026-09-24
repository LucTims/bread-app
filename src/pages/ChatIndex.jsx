import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Notification, MagicStar, Profile2User } from 'iconsax-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function ChatIndex() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [lastCommunityMsg, setLastCommunityMsg] = useState('Rejoignez la discussion...');
    const [lastCommunityTime, setLastCommunityTime] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        async function fetchUnread() {
            try {
                const { count: totalCount } = await supabase.from('notifications').select('id', { count: 'exact', head: true });
                const { count: readCount } = await supabase.from('notification_reads').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
                setUnreadCount(Math.max(0, (totalCount || 0) - (readCount || 0)));
            } catch (err) {
                console.error('[ChatIndex] Unread count error:', err);
            }
        }
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        async function fetchLastMessage() {
            try {
                const { data, error } = await supabase
                    .from('chat_messages')
                    .select('content, created_at, profiles(full_name)')
                    .order('created_at', { ascending: false })
                    .limit(1);
                
                if (!error && data && data.length > 0) {
                    const msg = data[0];
                    let content = msg.content || '';
                    if (content.startsWith('[IMAGE]')) {
                        content = '📷 Photo';
                    }
                    const senderName = msg.profiles?.full_name?.split(' ')[0] || 'Quelqu\'un';
                    setLastCommunityMsg(`~ ${senderName}: ${content}`);
                    
                    const date = new Date(msg.created_at);
                    const now = new Date();
                    if (date.toDateString() === now.toDateString()) {
                        setLastCommunityTime(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                    } else {
                        setLastCommunityTime(date.toLocaleDateString([], { day: '2-digit', month: 'short' }));
                    }
                }
            } catch (e) {
                console.error("Erreur chargement dernier message:", e);
            }
        }
        fetchLastMessage();
    }, []);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
            <header style={{
                padding: 'var(--space-4) var(--space-6)',
                background: 'var(--color-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
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
            </header>

            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'var(--bottom-nav-height)' }}>
                {/* Chat IA */}
                <div 
                    onClick={() => navigate('/chat/ai')}
                    style={{ 
                        display: 'flex', 
                        padding: '16px', 
                        borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        alignItems: 'center'
                    }}
                >
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: 'var(--color-primary)',
                        marginRight: '16px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <MagicStar size={28} color="#000" variant="Bold" />
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: 'var(--color-text)' }}>Assistant IA BoomRead</h2>
                            <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 500 }}>En ligne</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                ~ Comment puis-je vous aider avec vos lectures ?
                            </p>
                        </div>
                    </div>
                </div>

                {/* Communauté */}
                <div 
                    onClick={() => navigate('/chat/community')}
                    style={{ 
                        display: 'flex', 
                        padding: '16px', 
                        borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        alignItems: 'center'
                    }}
                >
                    <div style={{ 
                        width: '56px', height: '56px', borderRadius: '50%', 
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        marginRight: '16px', overflow: 'hidden', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <img src="/boombooks_logo.png" alt="Community" style={{ width: '60%', height: '60%', objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                        <span style={{ display: 'none' }}><Profile2User size={32} color="var(--color-text-muted)" variant="Linear" /></span>
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: 'var(--color-text)' }}>BoomBooks Inner Circle</h2>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{lastCommunityTime}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {lastCommunityMsg}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
