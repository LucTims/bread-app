import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function Chat() {
    const { user, profile } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    // Scroll to bottom when messages change
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!user) return;

        // Fetch initial messages
        const fetchMessages = async () => {
            try {
                const { data, error } = await supabase
                    .from('chat_messages')
                    .select('id, content, created_at, user_id, profiles(full_name, avatar_url, role)')
                    .order('created_at', { ascending: true })
                    .limit(50); // Get last 50 messages

                if (error) throw error;
                setMessages(data || []);
            } catch (err) {
                console.error('[Chat] Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        // Subscribe to real-time new messages
        const channel = supabase
            .channel('public:chat_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
                const newMsg = payload.new;
                
                // Fetch the profile for this new message
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url, role')
                    .eq('id', newMsg.user_id)
                    .single();

                const enrichedMsg = {
                    ...newMsg,
                    profiles: profileData || { full_name: 'Utilisateur', avatar_url: null, role: 'user' }
                };

                setMessages((prev) => [...prev, enrichedMsg]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;

        const content = newMessage.trim();
        setNewMessage(''); // optimistic clear

        try {
            const { error } = await supabase
                .from('chat_messages')
                .insert([{ user_id: user.id, content }]);

            if (error) {
                console.error('[Chat] Send error:', error);
                // Could restore the message text here if desired
            }
        } catch (err) {
            console.error('[Chat] Unexpected error:', err);
        }
    };

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - var(--nav-height))', paddingBottom: 'var(--space-4)' }}>
            <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4) 0', borderBottom: '1px solid var(--color-border)' }}>
                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Communauté</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Discutez avec d'autres lecteurs, partagez vos avis et proposez des améliorations.</p>
            </div>

            {/* Messages Area */}
            <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 'var(--space-4)',
                paddingBottom: 'var(--space-4)'
            }}>
                {messages.length === 0 ? (
                    <div className="empty-state" style={{ margin: 'auto' }}>
                        <span className="material-symbols-outlined empty-state-icon" style={{ color: 'var(--color-primary)', fontSize: 48 }}>forum</span>
                        <h3 style={{ fontWeight: 600, marginTop: 12 }}>Aucun message</h3>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 8 }}>Soyez le premier à démarrer la discussion !</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMine = msg.user_id === user.id;
                        const initial = (msg.profiles?.full_name || 'U').charAt(0).toUpperCase();
                        
                        return (
                            <div key={msg.id} style={{ 
                                display: 'flex', 
                                gap: 12, 
                                alignSelf: isMine ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                flexDirection: isMine ? 'row-reverse' : 'row'
                            }}>
                                {/* Avatar */}
                                <div style={{ 
                                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                    background: isMine ? 'var(--color-primary)' : 'var(--color-surface)',
                                    color: isMine ? '#000' : 'var(--color-text)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 600, fontSize: 12, overflow: 'hidden',
                                    border: `1px solid ${isMine ? 'rgba(0,0,0,0.1)' : 'var(--color-border)'}`
                                }}>
                                    {msg.profiles?.avatar_url 
                                        ? <img src={msg.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : initial
                                    }
                                </div>

                                {/* Message Bubble */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                                    <div style={{ 
                                        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                                        flexDirection: isMine ? 'row-reverse' : 'row'
                                    }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                            {isMine ? 'Vous' : (msg.profiles?.full_name || 'Utilisateur')}
                                        </span>
                                        {msg.profiles?.role === 'admin' && (
                                            <span style={{ 
                                                background: 'rgba(255, 214, 10, 0.2)', color: '#FFD60A',
                                                padding: '2px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700
                                            }}>ADMIN</span>
                                        )}
                                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.7 }}>
                                            {formatTime(msg.created_at)}
                                        </span>
                                    </div>

                                    <div style={{ 
                                        background: isMine ? 'var(--color-primary)' : 'var(--color-surface)',
                                        color: isMine ? '#000' : 'var(--color-text)',
                                        padding: '10px 14px',
                                        borderRadius: '16px',
                                        borderTopLeftRadius: !isMine ? 4 : 16,
                                        borderTopRightRadius: isMine ? 4 : 16,
                                        fontSize: 14,
                                        lineHeight: 1.5,
                                        boxShadow: isMine ? '0 4px 12px rgba(255, 214, 10, 0.2)' : 'none',
                                        border: isMine ? 'none' : '1px solid var(--color-border)'
                                    }}>
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} style={{ 
                display: 'flex', 
                gap: 8,
                background: 'var(--color-surface)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border)'
            }}>
                <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez un message..." 
                    style={{ 
                        flex: 1, 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--color-text)',
                        padding: '0 16px',
                        outline: 'none',
                        fontSize: 14
                    }}
                />
                <button 
                    type="submit" 
                    disabled={!newMessage.trim()}
                    style={{ 
                        width: 40, height: 40, borderRadius: '50%',
                        background: newMessage.trim() ? 'var(--color-primary)' : 'var(--color-border)',
                        color: newMessage.trim() ? '#000' : 'var(--color-text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 20, transform: 'translateX(2px)' }}>send</span>
                </button>
            </form>
        </div>
    );
}
