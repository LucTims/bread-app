// Gemini AI helper for BRead
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `Tu es un assistant de lecture intelligent intégré dans l'application BRead. 
Tu aides les lecteurs à comprendre le livre qu'ils lisent.

Règles :
- Réponds TOUJOURS en français, sauf si l'utilisateur pose la question dans une autre langue.
- Base tes réponses UNIQUEMENT sur le contenu du livre fourni en contexte.
- Si la réponse n'est pas dans le contexte, dis-le honnêtement.
- Sois concis mais précis. Utilise des paragraphes courts.
- Tu peux résumer, expliquer, analyser, comparer des passages.
- N'invente jamais d'informations qui ne sont pas dans le texte.`;

export async function askGemini(question, bookContext, chatHistory = []) {
    if (!GEMINI_API_KEY) {
        throw new Error('Clé API Gemini non configurée. Ajoutez VITE_GEMINI_API_KEY dans .env');
    }

    // Build conversation history for multi-turn
    const contents = [];

    // Add system instruction via first user message
    contents.push({
        role: 'user',
        parts: [{ text: `${SYSTEM_PROMPT}\n\n--- CONTENU DU LIVRE (contexte) ---\n${bookContext}\n--- FIN DU CONTENU ---` }]
    });
    contents.push({
        role: 'model',
        parts: [{ text: "Compris. Je suis prêt à répondre à vos questions sur ce livre. Comment puis-je vous aider ?" }]
    });

    // Add previous messages
    for (const msg of chatHistory) {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        });
    }

    // Add current question
    contents.push({
        role: 'user',
        parts: [{ text: question }]
    });

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: {
                temperature: 0.7,
                topP: 0.9,
                maxOutputTokens: 1024,
            }
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erreur Gemini (${response.status})`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Pas de réponse.";
}

// Quick actions
export const QUICK_ACTIONS = [
    { icon: 'summarize', label: 'Résumer', prompt: 'Résume cette page en quelques points clés.' },
    { icon: 'help', label: 'Expliquer', prompt: 'Explique le contenu de cette page de manière simple.' },
    { icon: 'psychology', label: 'Analyser', prompt: 'Analyse les idées principales de ce passage.' },
    { icon: 'translate', label: 'Traduire', prompt: 'Traduis le contenu principal de cette page en anglais.' },
    { icon: 'quiz', label: 'Quiz', prompt: 'Génère 3 questions de compréhension basées sur cette page avec les réponses.' },
];
