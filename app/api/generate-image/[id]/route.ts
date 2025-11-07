import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const getReplicate = () => {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not configured.');
  }
  return new Replicate({ auth: token });
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const replicate = getReplicate();

    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { detail: 'Prediction ID is required' },
        { status: 400 }
      );
    }

    const prediction = await replicate.predictions.get(id);

    if (prediction?.error) {
      return NextResponse.json({ detail: prediction.error }, { status: 500 });
    }

    return NextResponse.json(prediction);
  } catch (error) {
    console.error('[api/generate-image/:id] Error fetching prediction:', error);
    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
