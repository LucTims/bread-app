// AI Chat helper for BoomRead — calls the ai-chat Supabase Edge Function
// (OpenRouter/Gemini keys live server-side only, never shipped in the app bundle)

import { Note, MessageQuestion, Chart, Translate, TaskSquare, Book1, Discover, Award } from 'iconsax-react';
import { supabase } from './supabase';

async function callAiChat(mode, question, context, chatHistory) {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { mode, question, context, chatHistory },
    });

    if (error) {
        const message = data?.error || error.message || 'Erreur du serveur IA';
        throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data?.reply || 'Pas de réponse.';
}

export async function askGemini(question, bookContext, chatHistory = []) {
    return callAiChat('book', question, bookContext, chatHistory);
}

export async function askGlobalGemini(question, activityContext, chatHistory = []) {
    return callAiChat('global', question, activityContext, chatHistory);
}

// Quick actions
export const QUICK_ACTIONS = [
    { icon: Note, label: 'Résumer', prompt: 'Résume cette page en quelques points clés.' },
    { icon: MessageQuestion, label: 'Expliquer', prompt: 'Explique le contenu de cette page de manière simple.' },
    { icon: Chart, label: 'Analyser', prompt: 'Analyse les idées principales de ce passage.' },
    { icon: Translate, label: 'Traduire', prompt: 'Traduis le contenu principal de cette page en anglais.' },
    { icon: TaskSquare, label: 'Quiz', prompt: 'Génère 3 questions de compréhension basées sur cette page avec les réponses.' },
];

export const GLOBAL_QUICK_ACTIONS = [
    { icon: Book1, label: 'Où en suis-je ?', prompt: 'Fais-moi un résumé de ma progression de lecture actuelle.' },
    { icon: Discover, label: 'Que lire ?', prompt: 'Que devrais-je lire ensuite dans ma bibliothèque ?' },
    { icon: Award, label: 'Motivation', prompt: 'Encourage-moi pour ma série de lecture !' },
];
