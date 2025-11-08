import OpenAI from 'openai';
import Replicate from 'replicate';
import { NextResponse } from 'next/server';

const promptModel =
  process.env.OPENAI_IMAGE_PROMPT_MODEL ??
  process.env.OPENAI_AFFIRMATION_MODEL ??
  'gpt-4o-mini';

type ModelSpecifier = `${string}/${string}` | `${string}/${string}:${string}`;

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
    const baseModel =
      process.env.REPLICATE_NANO_BANANA_MODEL ?? 'google/nano-banana';
    const configuredVersion = process.env.REPLICATE_NANO_BANANA_VERSION;

    const resolveModelSpecifier = async (): Promise<ModelSpecifier> => {
      const ensureWithLatestVersion = async (
        modelName: string
      ): Promise<ModelSpecifier> => {
        const [owner, name] = modelName.split('/');
        if (!owner || !name) {
          throw new Error(
            `Model identifier "${modelName}" must be in the format "owner/name".`
          );
        }

        const modelInfo = await replicate.models.get(owner, name);
        const latestId = modelInfo?.latest_version?.id;
        if (!latestId) {
          throw new Error(
            `Unable to resolve a version for the model "${owner}/${name}".`
          );
        }
        return `${owner}/${name}:${latestId}` as ModelSpecifier;
      };

      if (!configuredVersion) {
        return await ensureWithLatestVersion(baseModel);
      }

      if (configuredVersion.includes(':')) {
        const [modelPart] = configuredVersion.split(':');
        if (!modelPart || !modelPart.includes('/')) {
          throw new Error(
            `Configured model "${configuredVersion}" must include an owner and name.`
          );
        }
        return configuredVersion as ModelSpecifier;
      }

      if (configuredVersion.includes('/')) {
        if (configuredVersion.includes(':')) {
          return configuredVersion as ModelSpecifier;
        }
        return await ensureWithLatestVersion(configuredVersion);
      }

      return `${baseModel}:${configuredVersion}` as ModelSpecifier;
    };

    const modelSpecifier = await resolveModelSpecifier();

    const output = await replicate.run(modelSpecifier, {
      input: {
        prompt: imagePrompt,
        output_format: 'jpg',
      },
    });

    const imageUrl =
      typeof output === 'string'
        ? output
        : Array.isArray(output) && output.length > 0
        ? String(output[0])
        : typeof output === 'object' && output !== null && 'url' in output
        ? String((output as { url?: string }).url)
        : null;

    if (!imageUrl) {
      throw new Error('Image generation returned no output.');
    }

    return NextResponse.json({
      imageUrl,
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
