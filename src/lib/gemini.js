// AI Chat helper for BRead — supports OpenRouter + Gemini fallback
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const SYSTEM_PROMPT = `Tu es un assistant de lecture intelligent intégré dans l'application BRead. 
Tu aides les lecteurs à comprendre le livre qu'ils lisent.

Règles :
- Réponds TOUJOURS en français, sauf si l'utilisateur pose la question dans une autre langue.
- Base tes réponses UNIQUEMENT sur le contenu du livre fourni en contexte.
- Si la réponse n'est pas dans le contexte, dis-le honnêtement.
- Sois concis mais précis. Utilise des paragraphes courts.
- Tu peux résumer, expliquer, analyser, comparer des passages.
- N'invente jamais d'informations qui ne sont pas dans le texte.`;

// ─── OpenRouter (primary) ───
async function askOpenRouter(question, bookContext, chatHistory = []) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `--- CONTENU DU LIVRE ---\n${bookContext}\n--- FIN ---` },
        { role: 'assistant', content: "Compris. Je suis prêt à répondre à vos questions sur ce livre." },
    ];

    for (const msg of chatHistory) {
        messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.text });
    }
    messages.push({ role: 'user', content: question });

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://breadapp.shop',
            'X-Title': 'BRead - Liseuse IA'
        },
        body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages,
            max_tokens: 1024,
            temperature: 0.7,
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erreur OpenRouter (${res.status})`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Pas de réponse.";
}

// ─── Gemini (fallback) ───
async function askGeminiDirect(question, bookContext, chatHistory = []) {
    const contents = [];
    contents.push({ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n--- CONTENU DU LIVRE ---\n${bookContext}\n--- FIN ---` }] });
    contents.push({ role: 'model', parts: [{ text: "Compris. Je suis prêt à répondre." }] });

    for (const msg of chatHistory) {
        contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
    }
    contents.push({ role: 'user', parts: [{ text: question }] });

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erreur Gemini (${res.status})`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Pas de réponse.";
}

// ─── Main export: tries OpenRouter first, then Gemini ───
export async function askGemini(question, bookContext, chatHistory = []) {
    if (!OPENROUTER_KEY && !GEMINI_KEY) {
        throw new Error('Aucune clé API configurée. Ajoutez VITE_OPENROUTER_API_KEY ou VITE_GEMINI_API_KEY dans .env');
    }

    if (OPENROUTER_KEY) {
        return askOpenRouter(question, bookContext, chatHistory);
    }
    return askGeminiDirect(question, bookContext, chatHistory);
}

// Quick actions
export const QUICK_ACTIONS = [
    { icon: 'summarize', label: 'Résumer', prompt: 'Résume cette page en quelques points clés.' },
    { icon: 'help', label: 'Expliquer', prompt: 'Explique le contenu de cette page de manière simple.' },
    { icon: 'psychology', label: 'Analyser', prompt: 'Analyse les idées principales de ce passage.' },
    { icon: 'translate', label: 'Traduire', prompt: 'Traduis le contenu principal de cette page en anglais.' },
    { icon: 'quiz', label: 'Quiz', prompt: 'Génère 3 questions de compréhension basées sur cette page avec les réponses.' },
];
