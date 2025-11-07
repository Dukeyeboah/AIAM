import { NextResponse } from 'next/server';

const ELEVENLABS_VOICES_ENDPOINT = 'https://api.elevenlabs.io/v1/voices';

export async function GET() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key is not configured.' },
        { status: 500 }
      );
    }

    const response = await fetch(ELEVENLABS_VOICES_ENDPOINT, {
      headers: {
        'xi-api-key': apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        {
          error: 'Failed to fetch voices from ElevenLabs.',
          detail,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ voices: data.voices ?? [] });
  } catch (error) {
    console.error('[api/voices] Error fetching voices:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load voices right now.',
      },
      { status: 500 }
    );
  }
}
