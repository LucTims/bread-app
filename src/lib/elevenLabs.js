// ElevenLabs TTS helper for BoomRead — calls the tts Supabase Edge Function
// (the ElevenLabs API key lives server-side only, never shipped in the app bundle)

import { supabase } from './supabase';

export async function fetchElevenLabsVoices() {
    try {
        const { data, error } = await supabase.functions.invoke('tts', { body: { action: 'voices' } });
        if (error || data?.error) throw new Error(data?.error || error.message);
        return data.voices || [];
    } catch (error) {
        console.error('Error fetching ElevenLabs voices:', error);
        return [];
    }
}

export async function getElevenLabsCredits() {
    try {
        const { data, error } = await supabase.functions.invoke('tts', { body: { action: 'credits' } });
        if (error || data?.error) throw new Error(data?.error || error.message);
        return {
            character_count: data.character_count,
            character_limit: data.character_limit
        };
    } catch (error) {
        console.error('Error fetching ElevenLabs credits:', error);
        return null;
    }
}

export async function generateElevenLabsSpeech(text, voiceId) {
    if (!text || !voiceId) return null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
            },
            body: JSON.stringify({ action: 'speech', text, voiceId })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Error generating speech');
        }

        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error('ElevenLabs TTS Error:', error);
        return null;
    }
}
