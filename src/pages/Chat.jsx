import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '👏', '😮'];

export default function Chat() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [chatOpen, setChatOpen] = useState(true);
    const [showEmojis, setShowEmojis] = useState(false);
    
    // Refs
    const messagesEndRef = useRef(null);
    const presenceChannelRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    // New features state
    const [replyingTo, setReplyingTo] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
    const [showEmojiPickerFor, setShowEmojiPickerFor] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [showInfoModal, setShowInfoModal] = useState(false);
    
    const isAdmin = profile?.role === 'admin';

    // Swipe to reply logic
    const swipeStateRef = useRef({ startX: 0, currentX: 0, isSwiping: false });

    const handleTouchStart = (e) => {
        swipeStateRef.current = {
            startX: e.touches[0].clientX,
            currentX: e.touches[0].clientX,
            isSwiping: true
        };
    };

    const handleTouchMove = (e) => {
        if (!swipeStateRef.current.isSwiping) return;
        const currentX = e.touches[0].clientX;
        const deltaX = currentX - swipeStateRef.current.startX;
        swipeStateRef.current.currentX = currentX;

        // Allow swiping right
        if (deltaX > 0 && deltaX < 80) {
            e.currentTarget.style.transform = `translateX(${deltaX}px)`;
            e.currentTarget.style.transition = 'none';
        }
    };

    const handleTouchEnd = (e, msg) => {
        if (!swipeStateRef.current.isSwiping) return;
        swipeStateRef.current.isSwiping = false;
        
        const deltaX = swipeStateRef.current.currentX - swipeStateRef.current.startX;
        
        e.currentTarget.style.transform = 'translateX(0)';
        e.currentTarget.style.transition = 'transform 0.2s ease-out';
        
        if (deltaX > 50) {
            setReplyingTo(msg);
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50);
            }
        }
    };

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
        if (e) e.preventDefault();
        if (!newMessage.trim() || !user || !chatOpen) return;

        const content = newMessage.trim();
        const replyId = replyingTo?.id || null;
        
        setNewMessage(''); 
        setReplyingTo(null);
        setShowEmojis(false);
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

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !user || !chatOpen) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `chat/${fileName}`;
        
        try {
            const { error: uploadErr } = await supabase.storage.from('covers').upload(filePath, file);
            if (!uploadErr) {
                const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(filePath);
                const content = `[IMAGE]${publicUrl}`;
                await supabase.from('chat_messages').insert([{ user_id: user.id, content, reply_to_id: replyingTo?.id || null }]);
                setReplyingTo(null);
            }
        } catch (err) {
            console.error('[Chat] Image upload error:', err);
        }
        
        // Reset input
        e.target.value = '';
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
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', background: 'var(--color-bg)', position: 'relative' }}>
            
            {/* WhatsApp Style Header */}
            <div style={{ 
                padding: '10px 16px', 
                background: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                zIndex: 10
            }}>
                {selectedMessage ? (
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 16 }}>
                        <button onClick={() => setSelectedMessage(null)} className="btn-ghost" style={{ padding: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>arrow_back</span>
                        </button>
                        <div style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>1</div>
                        <button onClick={() => { setReplyingTo(selectedMessage); setSelectedMessage(null); }} className="btn-ghost" style={{ padding: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>reply</span>
                        </button>
                        <button onClick={() => { navigator.clipboard.writeText(selectedMessage.content); setSelectedMessage(null); }} className="btn-ghost" style={{ padding: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>content_copy</span>
                        </button>
                        {(isAdmin || selectedMessage.user_id === user.id) && (
                            <button onClick={() => { handleDeleteMessage(selectedMessage.id); setSelectedMessage(null); }} className="btn-ghost" style={{ padding: 4 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>delete</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => navigate('/home')} className="btn-ghost" style={{ padding: 4, marginRight: 4 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>arrow_back</span>
                            </button>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), #FF8C00)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                <img src="/ai-logo.png" alt="BRead" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h1 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Communauté BRead</h1>
                                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                    {typingUsers.length > 0 ? `${typingUsers.join(', ')} écrit...` : 'Cliquez pour les infos'}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isAdmin && (
                                <button onClick={toggleChatStatus} className="btn-ghost" style={{ padding: 4, color: chatOpen ? 'inherit' : '#ef4444' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{chatOpen ? 'lock_open' : 'lock'}</span>
                                </button>
                            )}
                            <button onClick={() => navigate('/profile')} className="btn-ghost" style={{ padding: 4 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>account_circle</span>
                            </button>
                            <button onClick={() => setShowInfoModal(true)} className="btn-ghost" style={{ padding: 4 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>info</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 'var(--space-2)',
                padding: 'var(--space-4)',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.08\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                backgroundColor: 'var(--color-bg)'
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
                        
                        const isImage = msg.content && msg.content.startsWith('[IMAGE]');
                        const imageUrl = isImage ? msg.content.replace('[IMAGE]', '') : null;
                        
                        return (
                            <div key={msg.id} 
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={(e) => handleTouchEnd(e, msg)}
                                style={{ 
                                display: 'flex', 
                                gap: 8, 
                                alignSelf: isMine ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                flexDirection: isMine ? 'row-reverse' : 'row'
                            }}>
                                {/* Avatar (Only for others) */}
                                {!isMine && (
                                    <div style={{ 
                                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                        background: 'var(--color-surface)',
                                        color: 'var(--color-text)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 600, fontSize: 11, overflow: 'hidden',
                                        border: '1px solid var(--color-border)'
                                    }}>
                                        {displayAvatar 
                                            ? <img src={displayAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : initial
                                        }
                                    </div>
                                )}

                                {/* Message Bubble & Actions */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', position: 'relative' }}>
                                    
                                    {/* Sender Info (Only show for others) */}
                                    {!isMine && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, paddingLeft: 4 }}>
                                            <span style={{ fontSize: 11, fontWeight: 600, color: `hsl(${msg.user_id.charCodeAt(0) * 15 % 360}, 70%, 40%)` }}>
                                                {displayName}
                                            </span>
                                            {msg.profiles?.role === 'admin' && (
                                                <span style={{ background: 'rgba(255, 214, 10, 0.2)', color: '#FFD60A', padding: '1px 4px', borderRadius: 6, fontSize: 8, fontWeight: 700 }}>
                                                    ADMIN
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Main Bubble */}
                                    <div 
                                        onClick={() => setSelectedMessage(selectedMessage?.id === msg.id ? null : msg)}
                                        style={{ 
                                        position: 'relative',
                                        background: isMine ? 'var(--color-primary)' : 'var(--color-surface)',
                                        color: isMine ? '#000' : 'var(--color-text)',
                                        padding: '4px 6px 6px 8px',
                                        borderRadius: '8px',
                                        borderTopLeftRadius: !isMine ? 0 : 8,
                                        borderTopRightRadius: isMine ? 0 : 8,
                                        fontSize: 14,
                                        lineHeight: 1.4,
                                        boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                                        minWidth: '80px',
                                        cursor: 'pointer',
                                        ...(selectedMessage?.id === msg.id ? { outline: '2px solid rgba(255, 215, 0, 0.5)', background: isMine ? 'var(--color-primary-hover)' : 'rgba(255, 255, 255, 0.1)' } : {})
                                    }}>
                                        {/* Speech Bubble Tail */}
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            [isMine ? 'right' : 'left']: -8,
                                            width: 0,
                                            height: 0,
                                            borderTop: `10px solid ${isMine ? 'var(--color-primary)' : 'var(--color-surface)'}`,
                                            [isMine ? 'borderRight' : 'borderLeft']: '10px solid transparent'
                                        }} />

                                        {/* Reply Preview */}
                                        {msg.reply_to && (
                                            <div style={{
                                                background: 'rgba(0,0,0,0.05)',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                borderLeft: `4px solid ${isMine ? 'var(--color-bg)' : 'var(--color-primary)'}`,
                                                marginBottom: '4px',
                                                fontSize: '12px',
                                                maxWidth: '100%',
                                                marginTop: '2px'
                                            }}>
                                                <div style={{ fontWeight: 600, color: isMine ? 'var(--color-bg)' : 'var(--color-primary)', marginBottom: 2 }}>{msg.reply_to.profiles?.full_name || 'Utilisateur'}</div>
                                                <div className="line-clamp-1" style={{ color: 'rgba(0,0,0,0.6)' }}>{msg.reply_to.content}</div>
                                            </div>
                                        )}

                                        {isImage ? (
                                            <div style={{ paddingBottom: '12px' }}>
                                                <img src={imageUrl} alt="Image envoyée" style={{ maxWidth: '100%', borderRadius: 8, marginTop: 4, display: 'block' }} loading="lazy" />
                                            </div>
                                        ) : (
                                            <div style={{ paddingBottom: '12px', wordBreak: 'break-word' }}>{msg.content}</div>
                                        )}
                                        
                                        {/* Timestamp overlay */}
                                        <div style={{ 
                                            position: 'absolute', bottom: '4px', right: '6px',
                                            fontSize: '10px', color: 'rgba(0,0,0,0.45)',
                                            display: 'flex', alignItems: 'center', gap: 2
                                        }}>
                                            {formatTime(msg.created_at)}
                                            {isMine && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>done_all</span>}
                                        </div>

                                        {/* Reactions popup if selected */}
                                        {selectedMessage?.id === msg.id && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '-45px',
                                                [isMine ? 'right' : 'left']: 0,
                                                background: 'var(--color-surface)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 'var(--radius-full)',
                                                padding: '6px 12px',
                                                display: 'flex',
                                                gap: '12px',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                zIndex: 20
                                            }}>
                                                {QUICK_EMOJIS.map(emoji => (
                                                    <span key={emoji} 
                                                        onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); setSelectedMessage(null); }}
                                                        style={{ cursor: 'pointer', fontSize: '22px', transition: 'transform 0.2s' }}
                                                    >
                                                        {emoji}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
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

                {showEmojis && (
                    <div style={{
                        position: 'absolute',
                        bottom: '70px',
                        left: '16px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '16px',
                        padding: '12px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, 1fr)',
                        gap: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        zIndex: 50
                    }}>
                        {['😀', '😂', '😍', '😭', '🙏', '👍', '🔥', '❤️', '👏', '😮', '🤔', '😎', '🎉', '✨', '💯', '🙌', '👀', '🤷'].map(emoji => (
                            <span key={emoji} 
                                onClick={() => setNewMessage(prev => prev + emoji)}
                                style={{ cursor: 'pointer', fontSize: '24px', textAlign: 'center', userSelect: 'none' }}
                            >
                                {emoji}
                            </span>
                        ))}
                    </div>
                )}

                <input 
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                />
                <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    style={{ display: 'none' }} 
                    ref={cameraInputRef}
                    onChange={handleImageUpload}
                />

                <form onSubmit={handleSendMessage} style={{ 
                    display: 'flex', 
                    gap: 8,
                    padding: '8px',
                    opacity: chatOpen ? 1 : 0.6
                }}>
                    <div style={{
                        flex: 1,
                        background: 'var(--color-surface)',
                        borderRadius: '24px',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                        <button type="button" onClick={() => setShowEmojis(!showEmojis)} className="btn-ghost" style={{ padding: 4, color: showEmojis ? 'var(--color-primary)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>sentiment_satisfied</span>
                        </button>
                        <input 
                            type="text" 
                            value={newMessage}
                            onChange={handleTyping}
                            onFocus={() => setShowEmojis(false)}
                            placeholder={chatOpen ? "Message" : "Le chat est fermé"} 
                            disabled={!chatOpen}
                            style={{ 
                                flex: 1, 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'var(--color-text)',
                                outline: 'none',
                                fontSize: 15
                            }}
                        />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-ghost" style={{ padding: 4, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>attach_file</span>
                        </button>
                        <button type="button" onClick={() => cameraInputRef.current?.click()} className="btn-ghost" style={{ padding: 4, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>photo_camera</span>
                        </button>
                    </div>
                    <button 
                        type="submit" 
                        disabled={!newMessage.trim() || !chatOpen}
                        style={{ 
                            width: 48, height: 48, borderRadius: '50%',
                            background: 'var(--color-primary)',
                            color: '#000',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: 'none', cursor: (newMessage.trim() && chatOpen) ? 'pointer' : 'not-allowed',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            flexShrink: 0
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 24, transform: 'translateX(2px)' }}>send</span>
                    </button>
                </form>
            </div>

            {/* Info Modal */}
            {showInfoModal && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20
                }}>
                    <div style={{
                        background: 'var(--color-surface)',
                        borderRadius: '16px', padding: 24, width: '100%', maxWidth: 400,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                    }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Communauté BRead</h2>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
                            Bienvenue dans la communauté ! Discutez avec d'autres lecteurs, partagez vos coups de cœur et vos avis. Restez courtois et respectueux.
                        </p>
                        <button onClick={() => setShowInfoModal(false)} className="btn-primary" style={{ width: '100%', padding: 12, borderRadius: 8 }}>
                            Fermer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
