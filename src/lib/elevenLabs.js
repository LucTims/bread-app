const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;

export async function fetchElevenLabsVoices() {
    if (!API_KEY) return [];
    try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': API_KEY }
        });
        if (!response.ok) throw new Error('Failed to fetch voices');
        const data = await response.json();
        return data.voices || [];
    } catch (error) {
        console.error('Error fetching ElevenLabs voices:', error);
        return [];
    }
}

export async function getElevenLabsCredits() {
    if (!API_KEY) return null;
    try {
        const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
            headers: { 'xi-api-key': API_KEY }
        });
        if (!response.ok) throw new Error('Failed to fetch subscription');
        const data = await response.json();
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
    if (!API_KEY || !text || !voiceId) return null;
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': API_KEY
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2' // Good for French & other languages
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail?.message || 'Error generating speech');
        }

        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error('ElevenLabs TTS Error:', error);
        return null;
    }
}
