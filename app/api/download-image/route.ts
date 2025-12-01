import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { url, fileName } = (await req.json()) as {
      url?: string;
      fileName?: string;
    };

    if (!url) {
      return NextResponse.json(
        { error: 'Image URL is required.' },
        { status: 400 }
      );
    }

    // Fetch the image server-side to avoid CORS issues in the browser
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: 'Failed to fetch image from storage.',
          status: upstream.status,
        },
        { status: 500 }
      );
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get('content-type') ?? 'application/octet-stream';
    const safeName =
      (fileName && fileName.replace(/[^a-zA-Z0-9._-]/g, '_')) ||
      'affirmation.jpg';

    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[api/download-image] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to prepare image for download.',
      },
      { status: 500 }
    );
  }
}
