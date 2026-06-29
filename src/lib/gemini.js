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

const GLOBAL_SYSTEM_PROMPT = `Tu es un compagnon de lecture et assistant intelligent intégré dans l'application BRead.
Tu connais l'activité de l'utilisateur sur l'application (les livres de sa bibliothèque, leur résumé complet, son livre actuellement en cours de lecture, sa progression, son profil).

Ton but est d'accompagner l'utilisateur dans son parcours de lecteur :
- Aide-le à choisir son prochain livre parmi ceux de sa bibliothèque en te basant sur le résumé des livres ou suggère-lui des genres.
- S'il pose des questions sur sa progression, réponds-lui chaleureusement en utilisant ses données.
- S'il veut parler d'un de ses livres, réponds avec tes connaissances générales sur ce livre et son résumé tout en l'encourageant à le lire dans le Reader.
- Sois chaleureux, motivant, concis et précis. Réponds toujours en français.
- N'hésite pas à le féliciter pour sa régularité ou sa progression actuelle !`;

export async function askGlobalGemini(question, activityContext, chatHistory = []) {
    if (!OPENROUTER_KEY && !GEMINI_KEY) {
        throw new Error('Aucune clé API configurée. Ajoutez VITE_OPENROUTER_API_KEY ou VITE_GEMINI_API_KEY dans .env');
    }

    // OpenRouter path
    if (OPENROUTER_KEY) {
        try {
            const messages = [
                { role: 'system', content: GLOBAL_SYSTEM_PROMPT },
                { role: 'user', content: `--- CONTEXTE UTILISATEUR ---\n${activityContext}\n--- FIN CONTEXTE ---` },
                { role: 'assistant', content: "Compris. Je suis prêt à vous accompagner dans vos lectures !" },
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
                    'X-Title': 'BRead - Compagnon IA'
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.5-flash',
                    messages,
                    max_tokens: 400, // Reduced from 1024 to save credits
                    temperature: 0.7,
                })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error?.message || `Erreur OpenRouter (${res.status})`);
            }
            const data = await res.json();
            return data.choices?.[0]?.message?.content || "Pas de réponse.";
        } catch (err) {
            console.warn('[GlobalAIChat] OpenRouter failed, attempting fallback to Gemini if key exists.', err);
            if (!GEMINI_KEY) throw err; // If no fallback available, throw the original error
        }
    }

    // Gemini Path
    const contents = [];
    contents.push({ role: 'user', parts: [{ text: `${GLOBAL_SYSTEM_PROMPT}\n\n--- CONTEXTE UTILISATEUR ---\n${activityContext}\n--- FIN CONTEXTE ---` }] });
    contents.push({ role: 'model', parts: [{ text: "Compris. Je suis prêt à vous accompagner !" }] });
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

export const GLOBAL_QUICK_ACTIONS = [
    { icon: 'book', label: 'Où en suis-je ?', prompt: 'Fais-moi un résumé de ma progression de lecture actuelle.' },
    { icon: 'explore', label: 'Que lire ?', prompt: 'Que devrais-je lire ensuite dans ma bibliothèque ?' },
    { icon: 'celebration', label: 'Motivation', prompt: 'Encourage-moi pour ma série de lecture !' },
];
