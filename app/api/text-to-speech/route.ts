import { NextResponse } from 'next/server';

const ELEVENLABS_TTS_ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_MODEL = 'eleven_multilingual_v2';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key is not configured.' },
        { status: 500 }
      );
    }

    const { text, voiceId } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required to generate speech.' },
        { status: 400 }
      );
    }

    if (!voiceId || typeof voiceId !== 'string') {
      return NextResponse.json(
        { error: 'A valid voiceId is required.' },
        { status: 400 }
      );
    }

    const response = await fetch(`${ELEVENLABS_TTS_ENDPOINT}/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL,
        voice_settings: {
          // Stability (0.0-1.0): Higher = more consistent, less variation
          // For meditative: Higher stability (0.7-0.9) = more consistent, calming delivery
          stability: 0.75,
          similarity_boost: 0.75,
          // Style (0.0-1.0): Lower = more natural/conversational, Higher = more expressive/dramatic
          // For meditative: Lower style (0.0-0.2) = more natural, calm, less dramatic
          style: 0.15,
          use_speaker_boost: true,
        },
        output_format: 'mp3_44100_128',
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        {
          error: 'Failed to generate speech with ElevenLabs.',
          detail,
        },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
      },
    });
  } catch (error) {
    console.error('[api/text-to-speech] Error generating audio:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to generate speech.',
      },
      { status: 500 }
    );
  }
}
