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
    const useUserImages: boolean = Boolean(body?.useUserImages);
    const userImages:
      | { portrait?: string | null; fullBody?: string | null }
      | undefined = body?.userImages;
    const aspectRatio: string | undefined = body?.aspectRatio ?? '1:1';
    const demographics:
      | {
          ageRange?: string;
          gender?: string;
          ethnicity?: string;
          nationality?: string;
        }
      | undefined = body?.demographics;
    // Process image URLs - ensure they're valid and accessible
    let processedImageInputs: string[] = [];
    if (useUserImages && userImages) {
      const urls: string[] = [];
      if (userImages.portrait && typeof userImages.portrait === 'string') {
        urls.push(userImages.portrait);
      }
      if (userImages.fullBody && typeof userImages.fullBody === 'string') {
        urls.push(userImages.fullBody);
      }

      // If URLs are Firebase Storage gs:// URLs, we need to convert them
      // For now, we'll use them as-is since getDownloadURL should provide https URLs
      processedImageInputs = urls.filter((url) => {
        // Validate URL format
        try {
          new URL(url);
          return true;
        } catch {
          console.warn('[api/predictions] Invalid image URL format:', url);
          return false;
        }
      });
    }

    const imageInputs = processedImageInputs;

    if (!affirmation) {
      return NextResponse.json(
        { error: 'Affirmation text is required.' },
        { status: 400 }
      );
    }

    const openai = getOpenAI();
    // Check if we have at least one reference image
    const hasReferenceImages = useUserImages && imageInputs.length > 0;

    // Build context based on which images are available
    let imageReferenceText = '';
    if (userImages?.portrait && userImages?.fullBody) {
      imageReferenceText = `PORTRAIT/CLOSE-UP REFERENCE (use for FACE): ${userImages.portrait}
FULL-BODY REFERENCE (use for BODY SHAPE, BUILD, PROPORTIONS): ${userImages.fullBody}

CRITICAL: Use the PORTRAIT/CLOSE-UP image to match the FACE, FACIAL FEATURES, and HEAD. Use the FULL-BODY image to match BODY SHAPE, BUILD, HEIGHT, and PROPORTIONS.`;
    } else if (userImages?.portrait) {
      imageReferenceText = `PORTRAIT/CLOSE-UP REFERENCE (use for FACE and HEAD): ${userImages.portrait}`;
    } else if (userImages?.fullBody) {
      imageReferenceText = `FULL-BODY REFERENCE (use for FACE, BODY SHAPE, BUILD, and PROPORTIONS): ${userImages.fullBody}`;
    }

    const additionalContext = hasReferenceImages
      ? `\n\n=== CRITICAL INSTRUCTION: USER REFERENCE PHOTOS PROVIDED ===
The user has provided personal reference photos that MUST be used to generate an image with their EXACT likeness. The generated image MUST show the SAME PERSON from the reference photos with photorealistic precision.

${imageReferenceText}

MANDATORY REQUIREMENTS FOR EXACT LIKENESS:

1. FACIAL FEATURES - Match EXACTLY from the PORTRAIT/CLOSE-UP reference (or full-body if portrait not available):
   - Use the PORTRAIT/CLOSE-UP image as the PRIMARY source for ALL facial features
   - Eye shape, eye color, eye spacing, eyelid shape - EXACT match
   - Nose shape, size, width, bridge height, nostril shape - EXACT match
   - Mouth shape, lip size, lip color, cupid's bow - EXACT match
   - Jawline, chin shape, cheekbone structure - EXACT match
   - Facial bone structure, face shape (oval, round, square, etc.) - EXACT match
   - Eyebrow shape, thickness, arch, color - EXACT match
   - The face MUST be immediately recognizable as the same person from the portrait/close-up photo

2. SKIN TONE & TEXTURE - Match PRECISELY from reference photos:
   - Exact skin color, undertones (warm, cool, neutral) - must match reference
   - Skin texture, smoothness, any visible pores - must match reference
   - Any distinctive skin features (freckles, moles, birthmarks) - must match reference exactly

3. HAIR - Match EXACTLY from the PORTRAIT/CLOSE-UP reference:
   - Hair color (exact shade, highlights, lowlights) - EXACT match
   - Hair texture (straight, wavy, curly, coily) - EXACT match
   - Hair length, style, density, volume - EXACT match
   - Hairline shape, part location - EXACT match
   - Any distinctive hair characteristics - EXACT match

4. BODY PROPORTIONS - Match EXACTLY from the FULL-BODY reference (if provided):
   - If full-body reference is provided, use it for: height, build, body frame, shoulder width, waist size, hip width, posture, stance, body shape, muscle definition, body type
   - If only portrait is provided, maintain realistic body proportions that match the person's apparent build from the portrait

5. DISTINCTIVE FEATURES - Preserve ALL from reference photos:
   - Birthmarks, freckles, moles, scars - must match reference exactly
   - Unique facial characteristics - must match reference exactly
   - Any distinguishing features that make this person recognizable - must match reference exactly

CRITICAL RULES:
- The PORTRAIT/CLOSE-UP image is the PRIMARY source for facial features, skin tone, and hair
- The FULL-BODY image is the PRIMARY source for body shape, build, height, and proportions
- The face in the generated image MUST look EXACTLY like the face in the portrait/close-up reference photo
- The body proportions MUST match the full-body reference photo (if provided)
- The clothing, setting, background, and pose can change to fit the affirmation category and context
- But the person's physical appearance, face, skin tone, hair, and body proportions MUST be PHOTOREALISTIC and IDENTICAL to the reference photos
- The person must be immediately recognizable as the same person from the reference photos

ADDITIONAL CHARACTERS (if any appear in the scene):
- If other people or characters appear in the generated image, make them of similar ethnicity, race, and cultural background to the main person (the user) for relatability and representation
- Other characters should share similar skin tone, facial features, and cultural characteristics when appropriate
- However, diversity is welcome - occasionally include characters of different backgrounds when it makes sense for the scene context
- The main person (the user) must always remain the primary focus and be clearly identifiable

Generate ultra-high quality, photorealistic images that look like professional photography. The person must be immediately recognizable as the same person from the reference photos.`
      : '';
    const demographicContext =
      !useUserImages && demographics
        ? (() => {
            const traits: string[] = [];
            if (demographics.gender)
              traits.push(`gender: ${demographics.gender}`);
            if (demographics.ageRange)
              traits.push(`age: ${demographics.ageRange}`);
            if (demographics.ethnicity)
              traits.push(`ethnicity: ${demographics.ethnicity}`);
            if (demographics.nationality)
              traits.push(`nationality: ${demographics.nationality}`);
            return traits.length
              ? `\nIf you depict a person, align their appearance with these user preferences: ${traits.join(
                  ', '
                )}.`
              : '';
          })()
        : '';
    const promptCompletion = await openai.chat.completions.create({
      model: promptModel,
      temperature: 0.8,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: hasReferenceImages
            ? "You translate affirmations into evocative visual art prompts for text-to-image models. When user reference photos are provided, you MUST ensure the generated image shows the EXACT same person from the reference photos. The person's facial features, skin tone, hair, and body proportions must be identical to the reference. Only the clothing, setting, and pose can vary. Focus on mood, lighting, and key elements that visually convey the message of the affirmation while maintaining the exact likeness of the reference person. Always emphasize that the person in the generated image must be photorealistic and look exactly like the person in the reference photos."
            : 'You translate affirmations into evocative visual art prompts for text-to-image models. Focus on mood, lighting, and key elements that visually aptly convey the message of the affirmation.',
        },
        {
          role: 'user',
          content: [
            'Affirmation:',
            affirmation,
            category ? `Category: ${category}` : '',
            'Create a concise image prompt (max 70 words) describing a single scene that captures the essence of the affirmation.',
            'Specify mood, lighting, environment, and any symbolic elements that visually aptly convey the message of the affirmation.. Use descriptive adjectives. Do not mention text or typography.',
            additionalContext,
            demographicContext,
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

    // Use nano-banana-pro for personal images, regular nano-banana for generic images
    const useProModel = useUserImages && imageInputs.length > 0;
    const baseModel = useProModel
      ? process.env.REPLICATE_NANO_BANANA_PRO_MODEL ?? 'google/nano-banana'
      : process.env.REPLICATE_NANO_BANANA_MODEL ?? 'google/nano-banana';

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

      // For pro model, always use latest version (no configured version needed)
      if (useProModel) {
        return await ensureWithLatestVersion(baseModel);
      }

      // For regular model, check for configured version
      const configuredVersion = process.env.REPLICATE_NANO_BANANA_VERSION;
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

    if (imageInputs.length > 0) {
      console.log('[api/predictions] Including reference images:', {
        count: imageInputs.length,
        urls: imageInputs,
        useUserImages,
        hasPortrait: !!userImages?.portrait,
        hasFullBody: !!userImages?.fullBody,
        useProModel,
      });
    } else if (useUserImages) {
      console.warn(
        '[api/predictions] useUserImages is true but no image inputs found:',
        {
          useUserImages,
          userImages,
          portrait: userImages?.portrait,
          fullBody: userImages?.fullBody,
        }
      );
    }

    // Prepare input based on model type
    const input: any = {
      prompt: imagePrompt,
      output_format: 'jpg',
      aspect_ratio: aspectRatio,
    };

    // For nano-banana-pro, use different input structure
    if (useProModel && imageInputs.length > 0) {
      input.image_input = imageInputs;
      // Set resolution for pro model (1K, 2K, or 4K) - default to 2K for balance of quality and cost
      input.resolution =
        process.env.REPLICATE_NANO_BANANA_PRO_RESOLUTION ?? '2K';
      console.log(
        '[api/predictions] Using nano-banana-pro with reference images:',
        {
          model: modelSpecifier,
          imageInputCount: imageInputs.length,
          resolution: input.resolution,
          aspectRatio: input.aspect_ratio,
        }
      );
    } else if (imageInputs.length > 0) {
      // Regular nano-banana also supports image_input
      input.image_input = imageInputs;
      console.log(
        '[api/predictions] Using nano-banana with reference images:',
        {
          model: modelSpecifier,
          imageInputCount: imageInputs.length,
        }
      );
    }

    console.log('[api/predictions] Final Replicate input:', {
      prompt: imagePrompt.substring(0, 100) + '...',
      hasImageInput: !!input.image_input,
      imageInputCount: input.image_input?.length || 0,
      aspectRatio: input.aspect_ratio,
      resolution: input.resolution,
      model: modelSpecifier,
    });

    const output = await replicate.run(modelSpecifier, { input });

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
