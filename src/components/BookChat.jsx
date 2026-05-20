import { useState, useRef, useEffect } from 'react';
import { askGemini, QUICK_ACTIONS } from '../lib/gemini';

export default function BookChat({ isOpen, onClose, extractPageText, pageNumber, numPages, bookTitle }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [contextPages, setContextPages] = useState('current'); // 'current' | '3pages' | '5pages'
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
    }, [isOpen]);

    const getBookContext = async () => {
        const pages = [];
        let start = pageNumber, end = pageNumber;
        
        if (contextPages === '3pages') {
            start = Math.max(1, pageNumber - 1);
            end = Math.min(numPages || pageNumber, pageNumber + 1);
        } else if (contextPages === '5pages') {
            start = Math.max(1, pageNumber - 2);
            end = Math.min(numPages || pageNumber, pageNumber + 2);
        }

        for (let p = start; p <= end; p++) {
            const text = await extractPageText(p);
            if (text) pages.push(`[Page ${p}]\n${text}`);
        }
        return pages.join('\n\n') || 'Aucun texte extractible sur cette page.';
    };

    const sendMessage = async (text) => {
        if (!text.trim() || loading) return;
        const userMsg = { role: 'user', text: text.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const context = await getBookContext();
            // Only send last 6 messages for context window
            const history = [...messages.slice(-6), userMsg];
            const reply = await askGemini(text.trim(), context, history);
            setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', text: `❌ ${err.message}`, isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAction = (prompt) => sendMessage(prompt);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 300,
            display: 'flex', flexDirection: 'column',
            background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(20px)',
            animation: 'slideUp 0.3s ease'
        }}>
            {/* Header */}
            <div style={{
                padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: 'linear-gradient(135deg, var(--color-primary), #FF8C00)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#000' }}>smart_toy</span>
                    </div>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>Assistant IA</h3>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Page {pageNumber} • {bookTitle || 'Livre'}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Context selector */}
                    <select value={contextPages} onChange={e => setContextPages(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10 }}>
                        <option value="current" style={{ background: '#1a1a1a' }}>1 page</option>
                        <option value="3pages" style={{ background: '#1a1a1a' }}>3 pages</option>
                        <option value="5pages" style={{ background: '#1a1a1a' }}>5 pages</option>
                    </select>
                    <button onClick={onClose} style={{ color: '#fff', padding: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '20px 0' }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: 20,
                            background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,140,0,0.15))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-primary)' }}>auto_awesome</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Discutez avec votre livre</h3>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', maxWidth: 260, lineHeight: 1.5 }}>
                                Posez des questions, demandez des résumés ou des explications sur la page que vous lisez.
                            </p>
                        </div>

                        {/* Quick actions */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 320 }}>
                            {QUICK_ACTIONS.map((a, i) => (
                                <button key={i} onClick={() => handleQuickAction(a.prompt)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '8px 14px', borderRadius: 20,
                                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 500,
                                        transition: 'all 0.2s ease', cursor: 'pointer'
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{a.icon}</span>
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} style={{
                        display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        animation: 'fadeIn 0.3s ease'
                    }}>
                        <div style={{
                            maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: msg.role === 'user'
                                ? 'linear-gradient(135deg, var(--color-primary), #FFA000)'
                                : msg.isError ? 'rgba(228,30,63,0.15)' : 'rgba(255,255,255,0.08)',
                            color: msg.role === 'user' ? '#000' : '#fff',
                            fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                        }}>
                            {msg.role === 'assistant' && !msg.isError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--color-primary)' }}>smart_toy</span>
                                    <span style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 700 }}>IA</span>
                                </div>
                            )}
                            {msg.text}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{
                            padding: '12px 18px', borderRadius: '16px 16px 16px 4px',
                            background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8
                        }}>
                            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--color-primary)' }} />
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Réflexion...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick actions row (when chat has messages) */}
            {messages.length > 0 && (
                <div style={{ padding: '6px 12px', overflowX: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
                    {QUICK_ACTIONS.map((a, i) => (
                        <button key={i} onClick={() => handleQuickAction(a.prompt)} disabled={loading}
                            style={{
                                padding: '5px 10px', borderRadius: 14, whiteSpace: 'nowrap',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.5)', fontSize: 10, flexShrink: 0
                            }}>
                            {a.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div style={{
                padding: '10px 12px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
                borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-end'
            }}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Posez une question sur le livre..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                    disabled={loading}
                    style={{
                        flex: 1, padding: '12px 16px', borderRadius: 24,
                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                        color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit'
                    }}
                />
                <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
                    style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: input.trim() ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease', flexShrink: 0
                    }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: input.trim() ? '#000' : 'rgba(255,255,255,0.3)' }}>send</span>
                </button>
            </div>
        </div>
    );
}
