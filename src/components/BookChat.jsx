import { useState, useRef, useEffect } from 'react';
import { MagicStar, CloseCircle, Send } from 'iconsax-react';
import { askGemini, QUICK_ACTIONS } from '../lib/gemini';

export default function BookChat({ isOpen, onClose, extractPageText, pageNumber, numPages, bookTitle }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [contextPages, setContextPages] = useState('current'); // 'current' | '3pages' | '5pages' | 'all'
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
        } else if (contextPages === 'all') {
            start = 1;
            end = numPages || pageNumber;
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
            // If "all" is selected, the context extraction can take a few seconds
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
            background: 'var(--color-surface)',
            animation: 'slideUp 0.3s ease'
        }}>
            {/* Header */}
            <div style={{
                padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-border)', flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: 'var(--color-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <MagicStar size={18} color="#000" variant="Bold" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Assistant IA</h3>
                        <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: 0 }}>Page {pageNumber} • {bookTitle || 'Livre'}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Context selector */}
                    <select value={contextPages} onChange={e => setContextPages(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 8, background: 'var(--color-bg-light)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', fontSize: 10 }}>
                        <option value="current">1 page</option>
                        <option value="3pages">3 pages</option>
                        <option value="5pages">5 pages</option>
                        <option value="all">Tout le livre (Lent)</option>
                    </select>
                    <button onClick={onClose} style={{ color: 'var(--color-text)', padding: 4 }}>
                        <CloseCircle size={22} color="currentColor" variant="Linear" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '20px 0' }}>
                        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MagicStar size={32} color="#000" variant="Bold" />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>Discutez avec votre livre</h3>
                            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 260, lineHeight: 1.5 }}>
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
                                        background: 'var(--color-bg-light)', border: '1px solid var(--color-border)',
                                        color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 500,
                                        transition: 'all 0.2s ease', cursor: 'pointer'
                                    }}
                                >
                                    <a.icon size={16} color="currentColor" variant="Linear" />
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
                                ? 'var(--color-primary)'
                                : msg.isError ? 'rgba(220,38,38,0.1)' : 'var(--color-bg-light)',
                            color: msg.role === 'user' ? '#000' : 'var(--color-text)',
                            fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                        }}>
                            {msg.role === 'assistant' && !msg.isError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                                    <MagicStar size={14} color="var(--color-primary-text)" variant="Bold" />
                                    <span style={{ fontSize: 10, color: 'var(--color-primary-text)', fontWeight: 700 }}>IA</span>
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
                            background: 'var(--color-bg-light)', display: 'flex', alignItems: 'center', gap: 8
                        }}>
                            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Réflexion...</span>
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
                                background: 'var(--color-bg-light)', border: '1px solid var(--color-border)',
                                color: 'var(--color-text-muted)', fontSize: 10, flexShrink: 0
                            }}>
                            {a.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div style={{
                padding: '10px 12px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
                borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-end'
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
                        background: 'var(--color-bg-light)', border: '1px solid var(--color-border)',
                        color: 'var(--color-text)', fontSize: 13, outline: 'none', fontFamily: 'inherit'
                    }}
                />
                <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
                    style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: input.trim() ? 'var(--color-primary)' : 'var(--color-bg-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease', flexShrink: 0
                    }}>
                    <Send size={20} color={input.trim() ? '#000' : 'var(--color-text-muted)'} variant={input.trim() ? 'Bold' : 'Linear'} />
                </button>
            </div>
        </div>
    );
}
