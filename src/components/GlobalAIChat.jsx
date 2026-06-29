import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { askGlobalGemini, GLOBAL_QUICK_ACTIONS } from '../lib/gemini';
import { getOfflineBooksSync, getProgressMapSync } from '../lib/offlineStore';
import { supabase } from '../lib/supabase';

export default function GlobalAIChat() {
    const { user, profile } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [unread, setUnread] = useState(false);
    const [allBooks, setAllBooks] = useState(getOfflineBooksSync());
    const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
    
    useEffect(() => {
        const handleResize = () => {
            setViewportHeight(window.visualViewport ? window.visualViewport.height : window.innerHeight);
        };
        window.visualViewport?.addEventListener('resize', handleResize);
        window.addEventListener('resize', handleResize);
        handleResize(); // Init
        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize);
            window.removeEventListener('resize', handleResize);
        };
    }, []);
    
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Hide chat on Reader and Auth pages
    const hiddenPaths = ['/login', '/', '/offline'];
    const isHidden = hiddenPaths.includes(location.pathname) || location.pathname.startsWith('/reader/') || location.pathname.startsWith('/read/');

    useEffect(() => {
        if (isOpen) {
            setUnread(false);
            setTimeout(() => inputRef.current?.focus(), 300);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isOpen, messages]);

    // Fetch complete library from online
    useEffect(() => {
        if (!user || !navigator.onLine) return;
        async function fetchOnlineBooks() {
            try {
                let bookList = [];
                const { data: accessRows } = await supabase
                    .from('user_book_access')
                    .select('book_id, granted_at, books:book_id(id, title, author, description)')
                    .eq('user_id', user.id)
                    .order('granted_at', { ascending: false });

                if (accessRows?.length) {
                    bookList = accessRows.filter(r => r.books).map(r => ({ ...r.books, granted_at: r.granted_at }));
                } else {
                    const { data: orders } = await supabase.from('orders')
                        .select('id, order_items(book_id, books(id, title, author, description))')
                        .eq('user_id', user.id).eq('status', 'paid');
                    const seen = new Set();
                    (orders || []).forEach(o => o.order_items?.forEach(oi => {
                        if (oi.books && !seen.has(oi.books.id)) { seen.add(oi.books.id); bookList.push(oi.books); }
                    }));
                }
                
                // Merge with offline books
                const offline = getOfflineBooksSync();
                const offlineIds = new Set(offline.map(b => b.id));
                const combined = [...offline];
                for (const b of bookList) {
                    if (!offlineIds.has(b.id)) combined.push(b);
                }
                setAllBooks(combined);
            } catch(e) {
                console.error('[GlobalAIChat] error fetching online books:', e);
            }
        }
        fetchOnlineBooks();
    }, [user]);

    // Initial greeting if empty
    useEffect(() => {
        if (isOpen && messages.length === 0 && user) {
            const firstName = profile?.full_name?.split(' ')[0] || 'lecteur';
            setMessages([
                { role: 'assistant', text: `Bonjour ${firstName} ! 👋 Je suis l'assistant IA de BRead. Je vois que vous avez ${allBooks.length} livre(s) dans votre bibliothèque. Que puis-je faire pour vous aujourd'hui ?` }
            ]);
        }
    }, [isOpen, messages.length, user, profile, allBooks.length]);

    const getActivityContext = () => {
        const books = allBooks;
        const progressMap = getProgressMapSync();
        
        // Find last read book
        let lastRead = null;
        let latestTime = 0;
        
        const bookDetails = books.map(b => {
            const prog = progressMap[b.id];
            let progStr = "Non commencé";
            if (prog) {
                const pct = Math.round((prog.currentPage / prog.totalPages) * 100);
                progStr = `${pct}% (Page ${prog.currentPage}/${prog.totalPages})`;
                if (prog.lastReadAt && prog.lastReadAt > latestTime) {
                    latestTime = prog.lastReadAt;
                    lastRead = { ...b, progress: progStr };
                }
            }
            
            // Clean up description (remove HTML tags if any, limit length to avoid massive prompts if user has 100s of books)
            let desc = b.description || 'Pas de description.';
            desc = desc.replace(/<[^>]+>/g, '').substring(0, 500);
            
            return `- "${b.title}" de ${b.author} [${progStr}]\n  Résumé : ${desc}...`;
        }).join('\n\n');

        return `
Utilisateur: ${profile?.full_name || user?.email}
Série de lecture actuelle: ${profile?.current_streak || 0} jours
Dernier livre lu: ${lastRead ? `"${lastRead.title}" (${lastRead.progress})` : 'Aucun récemment'}
Livres dans la bibliothèque:
${bookDetails || 'Aucun livre pour le moment'}
        `;
    };

    const sendMessage = async (text) => {
        if (!text.trim() || loading) return;
        
        const userMsg = { role: 'user', text: text.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const context = getActivityContext();
            const history = messages.slice(-6);
            const reply = await askGlobalGemini(text.trim(), context, history);
            setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', text: `❌ ${err.message}`, isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    if (isHidden) return null;

    return (
        <div style={{ position: 'fixed', bottom: 'calc(var(--bottom-nav-height) + 16px)', right: '16px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {/* Chat Window */}
            {isOpen && (
                <div style={{
                    width: 'calc(100vw - 32px)', maxWidth: '360px', height: '500px', 
                    maxHeight: `${Math.max(250, viewportHeight - 120)}px`,
                    marginBottom: '12px',
                    background: 'rgba(20,20,20,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: 'var(--radius-xl)', border: '1px solid rgba(255,215,0,0.2)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '16px', background: 'linear-gradient(to right, rgba(255,215,0,0.1), transparent)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '10px',
                                background: 'linear-gradient(135deg, var(--color-primary), #FF8C00)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                            }}>
                                <img src="/ai-logo.png" alt="AI Assistant" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff' }}>Compagnon BRead</h3>
                                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>En ligne</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} style={{ color: 'rgba(255,255,255,0.6)', padding: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '85%', padding: '10px 14px',
                                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    background: msg.role === 'user' ? 'linear-gradient(135deg, var(--color-primary), #FF8C00)' : (msg.isError ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'),
                                    color: msg.role === 'user' ? '#000' : '#fff',
                                    fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                                }}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: 'rgba(255,255,255,0.08)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderTopColor: 'var(--color-primary)' }} />
                                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginLeft: '6px' }}>Réflexion...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    
                    {/* Quick Actions (only show if no messages or 1 message) */}
                    {messages.length <= 1 && (
                        <div style={{ padding: '8px 16px', display: 'flex', gap: '8px', overflowX: 'auto', flexShrink: 0 }} className="hide-scrollbar">
                            {GLOBAL_QUICK_ACTIONS.map((action, idx) => (
                                <button key={idx} onClick={() => sendMessage(action.prompt)} disabled={loading}
                                    style={{
                                        padding: '6px 12px', borderRadius: '16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'rgba(255,255,255,0.7)', fontSize: '11px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px'
                                    }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{action.icon}</span>
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input Area */}
                    <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Discutons de vos lectures..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                            disabled={loading}
                            style={{
                                flex: 1, padding: '10px 16px', borderRadius: '20px', background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px', outline: 'none'
                            }}
                        />
                        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
                            style={{
                                width: '38px', height: '38px', borderRadius: '50%',
                                background: input.trim() ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: input.trim() ? '#000' : 'rgba(255,255,255,0.3)', transition: 'background 0.2s'
                            }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Floating Bubble Button */}
            {!isOpen && (
                <button onClick={() => setIsOpen(true)} style={{
                    width: '56px', height: '56px', borderRadius: '28px',
                    background: 'linear-gradient(135deg, var(--color-primary), #FF8C00)',
                    boxShadow: '0 4px 20px rgba(255, 140, 0, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'transform 0.2s', position: 'relative',
                    padding: 0, border: 'none', overflow: 'hidden'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <img src="/ai-logo.png" alt="AI Assistant" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {unread && (
                        <span style={{
                            position: 'absolute', top: 0, right: 0, width: '14px', height: '14px',
                            background: '#ef4444', borderRadius: '50%', border: '2px solid #121212'
                        }} />
                    )}
                </button>
            )}
        </div>
    );
}
