import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const model = process.env.OPENAI_AFFIRMATION_MODEL ?? 'gpt-4o-mini';

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }
  return new OpenAI({ apiKey });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const category = body?.category ?? body?.categoryName;

    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { error: 'Category is required to generate an affirmation.' },
        { status: 400 }
      );
    }

    const openai = getClient();
    const shouldStartWithIAm = Math.random() < 0.9;

    const requirements = [
      `Create one powerful affirmation for the category "${category}".`,
      'Requirements:',
      shouldStartWithIAm
        ? '• Begin the sentence with the exact words "I am".'
        : '• Use a natural first-person opening such as "I", "I am", "I choose", or "My".',
      '• Present tense and realistic yet aspirational.',
      '• 20-32 words.',
      '• Include a specific, vivid detail, sensation, or action tied to the category so that it feels distinct from common phrases.',
      '• Avoid repeating familiar phrasing such as "warm and inviting home" or generic affirmations you may have produced earlier—use fresh adjectives and imagery.',
      '• Return only the affirmation text with no quotation marks.',
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.9,
      max_tokens: 160,
      messages: [
        {
          role: 'system',
          content:
            'You are an encouraging affirmation coach. Craft vivid, emotionally resonant affirmations that sound natural, grounded, and human.',
        },
        {
          role: 'user',
          content: requirements,
        },
      ],
    });

    let affirmation = completion.choices?.[0]?.message?.content ?? '';
    affirmation = affirmation.replace(/^["“”']+|["“”']+$/g, '').trim();

    if (!affirmation) {
      throw new Error('Affirmation generation returned no content.');
    }

    if (shouldStartWithIAm && !affirmation.toLowerCase().startsWith('i am')) {
      const trimmed = affirmation.replace(/^i\b/i, '').trimStart();
      affirmation = `I am ${trimmed}`.replace(/\s{2,}/g, ' ').trim();
    }

    return NextResponse.json({ affirmation });
  } catch (error) {
    console.error('[api/generate-affirmation] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate affirmation.',
      },
      { status: 500 }
    );
  }
}
