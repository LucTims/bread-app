import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '👏', '😮'];

export default function Chat() {
    const { user, profile } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [chatOpen, setChatOpen] = useState(true);
    
    // New features state
    const [replyingTo, setReplyingTo] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
    const [showEmojiPickerFor, setShowEmojiPickerFor] = useState(null);
    
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const presenceChannelRef = useRef(null);
    
    const isAdmin = profile?.role === 'admin';

    // Scroll to bottom when messages change
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!user) return;

        // Setup Presence for Typing Indicator
        const presenceChannel = supabase.channel('chat_presence', {
            config: { presence: { key: user.id } }
        });
        
        presenceChannelRef.current = presenceChannel;

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                const typing = [];
                for (const key in state) {
                    if (key !== user.id) {
                        const userState = state[key][0];
                        if (userState?.isTyping) {
                            typing.push(userState.name);
                        }
                    }
                }
                setTypingUsers(typing);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({ isTyping: false, name: user.user_metadata?.full_name || 'Quelqu\'un' });
                }
            });

        // Fetch initial messages and chat status
        const fetchData = async () => {
            try {
                // Fetch settings
                const { data: settingsData } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'chat_status')
                    .single();
                
                if (settingsData?.value) {
                    setChatOpen(settingsData.value.isOpen !== false);
                }

                // Fetch messages with replies and reactions
                const { data: msgData, error } = await supabase
                    .from('chat_messages')
                    .select(`
                        id, content, created_at, user_id, reply_to_id,
                        profiles(full_name, avatar_url, email, role),
                        reply_to:reply_to_id(id, content, profiles(full_name, email)),
                        chat_reactions(id, user_id, emoji)
                    `)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) throw error;
                setMessages(msgData ? msgData.reverse() : []);
            } catch (err) {
                console.error('[Chat] Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Subscribe to real-time chat_messages
        const msgChannel = supabase
            .channel('public:chat_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
                const newMsg = payload.new;
                
                // Fetch profile and reply data for the new message
                const { data: enrichedData } = await supabase
                    .from('chat_messages')
                    .select(`
                        id, content, created_at, user_id, reply_to_id,
                        profiles(full_name, avatar_url, email, role),
                        reply_to:reply_to_id(id, content, profiles(full_name, email)),
                        chat_reactions(id, user_id, emoji)
                    `)
                    .eq('id', newMsg.id)
                    .single();

                if (enrichedData) {
                    setMessages((prev) => [...prev, enrichedData]);
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
                const deletedId = payload.old.id;
                setMessages((prev) => prev.filter(msg => msg.id !== deletedId));
            })
            .subscribe();

        // Subscribe to real-time chat_reactions
        const reactionsChannel = supabase
            .channel('public:chat_reactions')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_reactions' }, (payload) => {
                setMessages((prev) => prev.map(msg => {
                    if (msg.id === payload.new.message_id) {
                        return { ...msg, chat_reactions: [...(msg.chat_reactions || []), payload.new] };
                    }
                    return msg;
                }));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_reactions' }, (payload) => {
                setMessages((prev) => prev.map(msg => {
                    if (msg.id === payload.old.message_id) {
                        return { ...msg, chat_reactions: (msg.chat_reactions || []).filter(r => r.id !== payload.old.id) };
                    }
                    return msg;
                }));
            })
            .subscribe();

        // Subscribe to real-time app_settings
        const settingsChannel = supabase
            .channel('public:app_settings')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'key=eq.chat_status' }, (payload) => {
                if (payload.new?.value) {
                    setChatOpen(payload.new.value.isOpen !== false);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(presenceChannel);
            supabase.removeChannel(msgChannel);
            supabase.removeChannel(reactionsChannel);
            supabase.removeChannel(settingsChannel);
        };
    }, [user]);

    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (!chatOpen || !presenceChannelRef.current) return;
        
        presenceChannelRef.current.track({ isTyping: true, name: user.user_metadata?.full_name || profile?.full_name || 'Quelqu\'un' });
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (presenceChannelRef.current) {
                presenceChannelRef.current.track({ isTyping: false, name: user.user_metadata?.full_name || profile?.full_name || 'Quelqu\'un' });
            }
        }, 2000);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || !chatOpen) return;

        const content = newMessage.trim();
        const replyId = replyingTo?.id || null;
        
        setNewMessage(''); 
        setReplyingTo(null);
        if (presenceChannelRef.current) {
            presenceChannelRef.current.track({ isTyping: false, name: user.user_metadata?.full_name || 'Quelqu\'un' });
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        try {
            const { error, data } = await supabase
                .from('chat_messages')
                .insert([{ user_id: user.id, content, reply_to_id: replyId }])
                .select();

            if (error) {
                console.error('[Chat] Send error:', error);
            } else if (replyingTo && replyingTo.user_id !== user.id) {
                // Send push notification to the replied user
                const authorName = user.user_metadata?.full_name || profile?.full_name || 'Un membre de la communauté';
                supabase.functions.invoke('notify-user', {
                    body: {
                        target_user_id: replyingTo.user_id,
                        title: `${authorName} vous a répondu`,
                        body: content,
                        type: 'chat_reply'
                    }
                }).catch(err => console.error('Push invoke error:', err));
            }
        } catch (err) {
            console.error('[Chat] Unexpected error:', err);
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!isAdmin) return;
        if (!window.confirm("Voulez-vous vraiment supprimer ce message pour tout le monde ?")) return;
        
        try {
            await supabase.from('chat_messages').delete().eq('id', messageId);
        } catch (err) {
            console.error('[Chat] Delete error:', err);
        }
    };

    const handleReaction = async (messageId, emoji) => {
        setShowEmojiPickerFor(null);
        if (!user) return;
        
        const message = messages.find(m => m.id === messageId);
        const existingReaction = message?.chat_reactions?.find(r => r.user_id === user.id && r.emoji === emoji);
        
        try {
            if (existingReaction) {
                await supabase.from('chat_reactions').delete().eq('id', existingReaction.id);
            } else {
                await supabase.from('chat_reactions').insert([{ message_id: messageId, user_id: user.id, emoji }]);
            }
        } catch (err) {
            console.error('[Chat] Reaction error:', err);
        }
    };

    const toggleChatStatus = async () => {
        if (!isAdmin) return;
        try {
            await supabase.from('app_settings').update({ value: { isOpen: !chatOpen } }).eq('key', 'chat_status');
        } catch (err) {
            console.error('[Chat] Toggle error:', err);
        }
    };

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    
    const getReactionsCount = (reactions) => {
        if (!reactions || reactions.length === 0) return [];
        const counts = {};
        reactions.forEach(r => {
            if (!counts[r.emoji]) counts[r.emoji] = { count: 0, hasReacted: false };
            counts[r.emoji].count++;
            if (r.user_id === user.id) counts[r.emoji].hasReacted = true;
        });
        return Object.entries(counts).map(([emoji, data]) => ({ emoji, ...data }));
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - var(--bottom-nav-height) - var(--space-4) - var(--space-6))' }}>
            <div style={{ 
                marginBottom: 'var(--space-2)', 
                paddingBottom: 'var(--space-3)', 
                borderBottom: '1px solid var(--color-border)', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                flexShrink: 0
            }}>
                <div>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Communauté</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Discutez avec d'autres lecteurs et partagez vos avis.</p>
                    {!chatOpen && <p style={{ color: '#ef4444', fontSize: 'var(--text-sm)', fontWeight: 600, marginTop: 4 }}>Le chat est actuellement fermé.</p>}
                </div>
                {isAdmin && (
                    <button onClick={toggleChatStatus} className="btn-ghost" style={{ 
                        display: 'flex', alignItems: 'center', gap: 6, 
                        color: chatOpen ? '#ef4444' : '#10b981',
                        border: `1px solid ${chatOpen ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                        borderRadius: 'var(--radius-md)', padding: '6px 12px', fontSize: 12, fontWeight: 600
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{chatOpen ? 'lock' : 'lock_open'}</span>
                        {chatOpen ? 'Fermer' : 'Ouvrir'}
                    </button>
                )}
            </div>

            {/* Messages Area */}
            <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 'var(--space-4)',
                paddingBottom: 'var(--space-4)',
                paddingRight: '4px' // for scrollbar
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
                        
                        const profileName = msg.profiles?.full_name || msg.profiles?.email?.split('@')[0] || 'Utilisateur';
                        const displayName = isMine 
                            ? (user.user_metadata?.full_name || profileName) 
                            : profileName;
                        
                        const displayAvatar = isMine 
                            ? (user.user_metadata?.avatar_url || msg.profiles?.avatar_url)
                            : msg.profiles?.avatar_url;

                        const initial = displayName.charAt(0).toUpperCase();
                        const groupedReactions = getReactionsCount(msg.chat_reactions);
                        
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
                                    {displayAvatar 
                                        ? <img src={displayAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : initial
                                    }
                                </div>

                                {/* Message Bubble & Actions */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                                    {/* Sender Info */}
                                    <div style={{ 
                                        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                                        flexDirection: isMine ? 'row-reverse' : 'row'
                                    }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                            {isMine ? 'Vous' : displayName}
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

                                    {/* Reply Preview */}
                                    {msg.reply_to && (
                                        <div onClick={() => {
                                            // Optional: Scroll to message
                                        }} style={{
                                            background: isMine ? 'rgba(0,0,0,0.1)' : 'var(--color-bg)',
                                            padding: '6px 10px',
                                            borderRadius: '8px',
                                            borderLeft: `3px solid ${isMine ? '#000' : 'var(--color-primary)'}`,
                                            marginBottom: '4px',
                                            fontSize: '12px',
                                            opacity: 0.8,
                                            maxWidth: '100%',
                                            cursor: 'pointer'
                                        }}>
                                            <div style={{ fontWeight: 600, marginBottom: 2 }}>{msg.reply_to.profiles?.full_name || 'Utilisateur'}</div>
                                            <div className="line-clamp-1">{msg.reply_to.content}</div>
                                        </div>
                                    )}

                                    {/* Main Bubble */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row' }}>
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

                                        {/* Action Buttons (Reply / Delete / React) */}
                                        <div style={{ display: 'flex', gap: 4, position: 'relative' }}>
                                            <button onClick={() => setReplyingTo(msg)} className="btn-ghost" title="Répondre"
                                                style={{ padding: 4, borderRadius: '50%' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>reply</span>
                                            </button>
                                            
                                            <button onClick={() => setShowEmojiPickerFor(showEmojiPickerFor === msg.id ? null : msg.id)} className="btn-ghost" title="Réagir"
                                                style={{ padding: 4, borderRadius: '50%' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_reaction</span>
                                            </button>

                                            {isAdmin && (
                                                <button onClick={() => handleDeleteMessage(msg.id)} className="btn-ghost" title="Supprimer"
                                                    style={{ padding: 4, color: '#ef4444', borderRadius: '50%' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                                                </button>
                                            )}

                                            {/* Emoji Picker Popup */}
                                            {showEmojiPickerFor === msg.id && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    [isMine ? 'right' : 'left']: 0,
                                                    background: 'var(--color-surface)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: 'var(--radius-full)',
                                                    padding: '4px 8px',
                                                    display: 'flex',
                                                    gap: '8px',
                                                    boxShadow: 'var(--shadow-md)',
                                                    zIndex: 10
                                                }}>
                                                    {QUICK_EMOJIS.map(emoji => (
                                                        <span key={emoji} 
                                                            onClick={() => handleReaction(msg.id, emoji)}
                                                            style={{ cursor: 'pointer', fontSize: '18px', transition: 'transform 0.2s' }}
                                                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                                                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                                        >
                                                            {emoji}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Reactions Badges */}
                                    {groupedReactions.length > 0 && (
                                        <div style={{ 
                                            display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4,
                                            flexDirection: isMine ? 'row-reverse' : 'row' 
                                        }}>
                                            {groupedReactions.map(r => (
                                                <button key={r.emoji} onClick={() => handleReaction(msg.id, r.emoji)} style={{
                                                    background: r.hasReacted ? 'rgba(255, 215, 0, 0.2)' : 'var(--color-surface)',
                                                    border: `1px solid ${r.hasReacted ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                                    borderRadius: '12px',
                                                    padding: '2px 6px',
                                                    fontSize: '12px',
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                    color: r.hasReacted ? 'var(--color-primary)' : 'var(--color-text)'
                                                }}>
                                                    <span>{r.emoji}</span>
                                                    <span>{r.count}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                
                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', paddingLeft: 44 }}>
                        {typingUsers.join(', ')} {typingUsers.length > 1 ? 'écrivent...' : 'écrit...'}
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ flexShrink: 0, marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Reply Preview Bar */}
                {replyingTo && (
                    <div style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-primary)',
                        borderLeft: '4px solid var(--color-primary)',
                        borderRadius: 'var(--radius-md)',
                        padding: '8px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 2 }}>
                                Réponse à {replyingTo.profiles?.full_name || 'Utilisateur'}
                            </div>
                            <div className="line-clamp-1" style={{ fontSize: 13, color: 'var(--color-text)' }}>
                                {replyingTo.content}
                            </div>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="btn-ghost" style={{ padding: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                        </button>
                    </div>
                )}

                <form onSubmit={handleSendMessage} style={{ 
                    display: 'flex', 
                    gap: 8,
                    background: 'var(--color-surface)',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-border)',
                    opacity: chatOpen ? 1 : 0.6
                }}>
                    <input 
                        type="text" 
                        value={newMessage}
                        onChange={handleTyping}
                        placeholder={chatOpen ? "Écrivez un message..." : "Le chat est fermé"} 
                        disabled={!chatOpen}
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
                        disabled={!newMessage.trim() || !chatOpen}
                        style={{ 
                            width: 40, height: 40, borderRadius: '50%',
                            background: (newMessage.trim() && chatOpen) ? 'var(--color-primary)' : 'var(--color-border)',
                            color: (newMessage.trim() && chatOpen) ? '#000' : 'var(--color-text-muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: 'none', cursor: (newMessage.trim() && chatOpen) ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 20, transform: 'translateX(2px)' }}>send</span>
                    </button>
                </form>
            </div>
        </div>
    );
}
