import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!API_KEY) throw new Error('Clé ElevenLabs non configurée côté serveur');

    const { action, text, voiceId } = await req.json();

    if (action === 'voices') {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': API_KEY }
      });
      if (!res.ok) throw new Error('Failed to fetch voices');
      const data = await res.json();
      return new Response(JSON.stringify({ voices: data.voices || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'credits') {
      const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        headers: { 'xi-api-key': API_KEY }
      });
      if (!res.ok) throw new Error('Failed to fetch subscription');
      const data = await res.json();
      return new Response(JSON.stringify({
        character_count: data.character_count,
        character_limit: data.character_limit
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'speech') {
      if (!text || !voiceId) throw new Error('Missing text or voiceId');
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': API_KEY
        },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.message || 'Error generating speech');
      }
      const arrayBuffer = await res.arrayBuffer();
      return new Response(arrayBuffer, {
        headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg' },
      });
    }

    throw new Error('Unknown action');
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
