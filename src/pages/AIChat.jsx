import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { askGlobalGemini, GLOBAL_QUICK_ACTIONS } from '../lib/gemini';
import { getOfflineBooksSync, getProgressMapSync } from '../lib/offlineStore';
import { supabase, getFreeBooks } from '../lib/supabase';

export default function AIChat() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [allBooks, setAllBooks] = useState(getOfflineBooksSync());
    
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
                }
                
                const { data: orders } = await supabase.from('orders')
                    .select('id, order_items(book_id, books(id, title, author, description))')
                    .eq('user_id', user.id).eq('status', 'paid');
                const seen = new Set(bookList.map(b => b.id));
                (orders || []).forEach(o => o.order_items?.forEach(oi => {
                    if (oi.books && !seen.has(oi.books.id)) { seen.add(oi.books.id); bookList.push(oi.books); }
                }));

                const freeBooks = await getFreeBooks();
                freeBooks.forEach(fb => {
                    if (!seen.has(fb.id)) { seen.add(fb.id); bookList.push(fb); }
                });
                
                // Merge with offline books
                const offline = getOfflineBooksSync();
                const offlineIds = new Set(offline.map(b => b.id));
                const combined = [...offline];
                for (const b of bookList) {
                    if (!offlineIds.has(b.id)) combined.push(b);
                }
                setAllBooks(combined);
            } catch(e) {
                console.error('[AIChat] error fetching online books:', e);
            }
        }
        fetchOnlineBooks();
    }, [user]);

    // Initial greeting if empty
    useEffect(() => {
        if (user && (messages.length === 0 || (messages.length === 1 && messages[0].role === 'assistant'))) {
            const firstName = profile?.full_name?.split(' ')[0] || 'lecteur';
            setMessages([
                { role: 'assistant', text: `Bonjour ${firstName} ! 👋 Je suis l'assistant IA de BoomRead. Je vois que vous avez ${allBooks.length} livre(s) dans votre bibliothèque. Que puis-je faire pour vous aujourd'hui ?` }
            ]);
        }
    }, [user, profile, allBooks.length]);

    const getActivityContext = () => {
        const books = allBooks;
        const progressMap = getProgressMapSync();
        
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
        
        if (!navigator.onLine) {
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                text: "💤 L'assistant IA se repose car vous n'avez pas de connexion Internet. Revenez me parler quand vous serez en ligne !",
                isError: true 
            }]);
            return;
        }

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

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', height: '100%' }}>
            {/* Header */}
            <div style={{
                padding: '10px 16px', background: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '12px',
                zIndex: 10, position: 'relative', flexShrink: 0
            }}>
                <button onClick={() => navigate('/chat')} className="btn-ghost" style={{ padding: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24 }}>arrow_back</span>
                </button>
                <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-primary), #FF8C00)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                }}>
                    <img src="/ai-logo.png" alt="AI Assistant" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>Assistant IA BoomRead</h1>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-primary)', fontWeight: 500 }}>En ligne</p>
                </div>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                            maxWidth: '85%', padding: '10px 14px',
                            borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: msg.role === 'user' ? 'linear-gradient(135deg, var(--color-primary), #FF8C00)' : (msg.isError ? 'rgba(239,68,68,0.2)' : 'var(--color-surface)'),
                            border: msg.role === 'assistant' && !msg.isError ? '1px solid var(--color-border)' : 'none',
                            color: msg.role === 'user' ? '#000' : 'var(--color-text)',
                            fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderTopColor: 'var(--color-primary)' }} />
                            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '6px' }}>Réflexion...</span>
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
                                padding: '8px 16px', borderRadius: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                color: 'var(--color-text)', fontSize: '13px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>{action.icon}</span>
                            {action.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Message..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                    disabled={loading}
                    style={{
                        flex: 1, padding: '12px 16px', borderRadius: '24px', background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: '15px', outline: 'none'
                    }}
                />
                <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
                    style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        background: input.trim() ? 'var(--color-primary)' : 'var(--color-surface)',
                        border: input.trim() ? 'none' : '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: input.trim() ? '#000' : 'var(--color-text-muted)', transition: 'background 0.2s',
                        cursor: input.trim() && !loading ? 'pointer' : 'default'
                    }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>send</span>
                </button>
            </div>
        </div>
    );
}
