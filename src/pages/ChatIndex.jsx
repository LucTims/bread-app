import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { SearchNormal1, Profile2User, MessageTick } from 'iconsax-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function ChatIndex() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [lastCommunityMsg, setLastCommunityMsg] = useState('Rejoignez la discussion...');
    const [lastCommunityTime, setLastCommunityTime] = useState('');

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
                padding: '16px 20px 16px 20px',
                background: 'var(--color-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <h1 style={{ fontSize: '26px', fontWeight: 'bold', margin: 0, color: 'var(--color-text)' }}>Discussions</h1>
            </header>

            <div style={{ padding: '0 20px 16px 20px' }}>
                <div style={{ 
                    display: 'flex', alignItems: 'center', background: 'var(--color-surface)', 
                    borderRadius: '24px', padding: '8px 16px', gap: '12px' 
                }}>
                    <SearchNormal1 size={18} color="var(--color-text-muted)" />
                    <input 
                        type="text" 
                        placeholder="Rechercher ou démarrer une discussion"
                        style={{ 
                            border: 'none', background: 'transparent', flex: 1, 
                            color: 'var(--color-text)', fontSize: '15px', outline: 'none' 
                        }} 
                    />
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'var(--bottom-nav-height)' }}>
                {/* Chat IA */}
                <div 
                    onClick={() => navigate('/chat/ai')}
                    style={{ 
                        display: 'flex', 
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        alignItems: 'center'
                    }}
                >
                    <div style={{
                        width: '52px', height: '52px', borderRadius: '50%',
                        background: 'var(--color-primary)',
                        marginRight: '16px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <img src="/ai-logo.png" alt="AI" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                        <span style={{ display: 'none', color: '#000', fontWeight: 'bold', fontSize: '20px' }}>IA</span>
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: 'var(--color-text)' }}>Assistant IA ebuk</h2>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>16:36</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MessageTick size={16} color="var(--color-text-muted)" variant="Outline" />
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Comment puis-je vous aider avec vos lectures ?
                            </p>
                        </div>
                    </div>
                </div>

                {/* Communauté */}
                <div 
                    onClick={() => navigate('/chat/community')}
                    style={{ 
                        display: 'flex', 
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        alignItems: 'center'
                    }}
                >
                    <div style={{ 
                        width: '52px', height: '52px', borderRadius: '50%', 
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        marginRight: '16px', overflow: 'hidden', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <img src="/boombooks_logo.png" alt="Community" style={{ width: '60%', height: '60%', objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                        <span style={{ display: 'none' }}><Profile2User size={24} color="var(--color-text-muted)" variant="Linear" /></span>
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: 'var(--color-text)' }}>BoomBooks Inner Circle</h2>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{lastCommunityTime || '16:28'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                                <MessageTick size={16} color="var(--color-primary)" variant="Bold" />
                                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {lastCommunityMsg}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
