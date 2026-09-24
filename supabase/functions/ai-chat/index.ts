import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const BOOK_SYSTEM_PROMPT = `Tu es un assistant de lecture intelligent intégré dans l'application BoomRead.
Tu aides les lecteurs à comprendre le livre qu'ils lisent.

Règles :
- Réponds TOUJOURS en français, sauf si l'utilisateur pose la question dans une autre langue.
- Base tes réponses UNIQUEMENT sur le contenu du livre fourni en contexte.
- Si la réponse n'est pas dans le contexte, dis-le honnêtement.
- Sois concis mais précis. Utilise des paragraphes courts.
- Tu peux résumer, expliquer, analyser, comparer des passages.
- N'invente jamais d'informations qui ne sont pas dans le texte.`;

const GLOBAL_SYSTEM_PROMPT = `Tu es un compagnon de lecture et assistant intelligent intégré dans l'application BoomRead.
Tu connais l'activité de l'utilisateur sur l'application (les livres de sa bibliothèque, leur résumé complet, son livre actuellement en cours de lecture, sa progression, son profil).

Ton but est d'accompagner l'utilisateur dans son parcours de lecteur :
- Aide-le à choisir son prochain livre parmi ceux de sa bibliothèque en te basant sur le résumé des livres ou suggère-lui des genres.
- S'il pose des questions sur sa progression, réponds-lui chaleureusement en utilisant ses données.
- S'il veut parler d'un de ses livres, réponds avec tes connaissances générales sur ce livre et son résumé tout en l'encourageant à le lire dans le Reader.
- Sois chaleureux, motivant, concis et précis. Réponds toujours en français.
- N'hésite pas à le féliciter pour sa régularité ou sa progression actuelle !`;

function formatApiError(message: string) {
  const lower = (message || '').toLowerCase();
  if (lower.includes('high demand') || lower.includes('spikes in demand') || lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
    return "L'intelligence artificielle est actuellement très sollicitée par de nombreux utilisateurs. Veuillez réessayer dans quelques instants ! ⏳";
  }
  if (lower.includes('api key') || lower.includes('unauthorized')) {
    return "Problème de clé API. L'assistant n'est pas autorisé à répondre.";
  }
  return `Erreur du serveur IA : ${message}`;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { mode, question, context, chatHistory = [] } = await req.json();
    if (!question) throw new Error('Missing question');

    const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY');
    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!OPENROUTER_KEY && !GEMINI_KEY) throw new Error('Aucune clé API IA configurée côté serveur');

    const isGlobal = mode === 'global';
    const systemPrompt = isGlobal ? GLOBAL_SYSTEM_PROMPT : BOOK_SYSTEM_PROMPT;
    const contextLabel = isGlobal ? '--- CONTEXTE UTILISATEUR ---' : '--- CONTENU DU LIVRE ---';
    const readyReply = isGlobal
      ? "Compris. Je suis prêt à vous accompagner dans vos lectures !"
      : "Compris. Je suis prêt à répondre à vos questions sur ce livre.";
    const maxTokens = isGlobal ? 400 : 1024;

    async function askOpenRouter() {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${contextLabel}\n${context}\n--- FIN ---` },
        { role: 'assistant', content: readyReply },
        ...chatHistory.map((m: { role: string; text: string }) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
        { role: 'user', content: question },
      ];
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://breadapp.shop',
          'X-Title': 'BoomRead - Liseuse IA',
        },
        body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages, max_tokens: maxTokens, temperature: 0.7 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erreur OpenRouter (${res.status})`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || 'Pas de réponse.';
    }

    async function askGeminiDirect() {
      const contents = [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${contextLabel}\n${context}\n--- FIN ---` }] },
        { role: 'model', parts: [{ text: readyReply }] },
        ...chatHistory.map((m: { role: string; text: string }) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: question }] },
      ];
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erreur Gemini (${res.status})`);
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Pas de réponse.';
    }

    let reply: string;
    if (OPENROUTER_KEY) {
      if (isGlobal) {
        try {
          reply = await askOpenRouter();
        } catch (err) {
          if (!GEMINI_KEY) throw err;
          reply = await askGeminiDirect();
        }
      } else {
        reply = await askOpenRouter();
      }
    } else {
      reply = await askGeminiDirect();
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: formatApiError(error.message) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
