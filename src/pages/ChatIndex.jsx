import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ChatIndex() {
    const navigate = useNavigate();
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
                padding: 'var(--space-4) var(--space-6)', 
                background: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: 'var(--color-text)' }}>Discussions</h1>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text)' }}>search</span>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text)' }}>more_vert</span>
                </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto' }}>
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
                        background: 'linear-gradient(135deg, var(--color-primary), #FF8C00)',
                        marginRight: '16px', overflow: 'hidden', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <img src="/ai-logo.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: 'var(--color-text)' }}>Assistant IA BRead</h2>
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
                        <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--color-text-muted)', display: 'none' }}>groups</span>
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
