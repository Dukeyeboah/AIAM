import OpenAI from 'openai';
import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const promptModel =
  process.env.OPENAI_IMAGE_PROMPT_MODEL ??
  process.env.OPENAI_AFFIRMATION_MODEL ??
  'gpt-4o-mini';

const getOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }
  return new OpenAI({ apiKey });
};

const getReplicate = () => {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not configured.');
  }
  return new Replicate({ auth: token });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const affirmation: string | undefined = body?.affirmation;
    const category: string | undefined = body?.category;

    if (!affirmation) {
      return NextResponse.json(
        { error: 'Affirmation text is required.' },
        { status: 400 }
      );
    }

    const replicateVersion = process.env.REPLICATE_NANO_BANANA_VERSION;
    if (!replicateVersion) {
      return NextResponse.json(
        { error: 'Replicate Nano-Banana version is not configured.' },
        { status: 500 }
      );
    }

    const openai = getOpenAI();
    const promptCompletion = await openai.chat.completions.create({
      model: promptModel,
      temperature: 0.8,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content:
            'You translate affirmations into evocative visual art prompts for text-to-image models. Focus on mood, lighting, and key elements.',
        },
        {
          role: 'user',
          content: [
            'Affirmation:',
            affirmation,
            category ? `Category: ${category}` : '',
            'Create a concise image prompt (max 70 words) describing a single scene that captures the essence of the affirmation.',
            'Specify mood, lighting, environment, and any symbolic elements. Use descriptive adjectives. Do not mention text or typography.',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    });

    const imagePrompt = promptCompletion.choices?.[0]?.message?.content?.trim();
    if (!imagePrompt) {
      throw new Error('Failed to craft an image prompt from the affirmation.');
    }

    const replicate = getReplicate();
    const prediction = await replicate.predictions.create({
      version: replicateVersion,
      input: {
        prompt: imagePrompt,
        negative_prompt:
          'text, words, watermark, signature, low quality, distorted, disfigured, extra limbs',
        num_inference_steps: 12,
        guidance_scale: 3.5,
      },
    });

    return NextResponse.json({
      predictionId: prediction.id,
      status: prediction.status,
      prompt: imagePrompt,
      imageUrl:
        Array.isArray(prediction.output) && prediction.output.length > 0
          ? prediction.output[0]
          : null,
    });
  } catch (error) {
    console.error('[api/generate-image] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate image.',
      },
      { status: 500 }
    );
  }
}
