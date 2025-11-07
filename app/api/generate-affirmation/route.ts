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
          content: [
            `Create one powerful affirmation for the category "${category}".`,
            'Requirements:',
            '• First-person voice beginning with "I" or "My".',
            '• Present tense and realistic yet aspirational.',
            '• 20-32 words.',
            '• Include a specific detail, sensation, or emotion tied to the category.',
            '• Avoid repeating phrases like "I am worthy" or generic clichés.',
          ].join('\n'),
        },
      ],
    });

    const affirmation = completion.choices?.[0]?.message?.content?.trim();

    if (!affirmation) {
      throw new Error('Affirmation generation returned no content.');
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
