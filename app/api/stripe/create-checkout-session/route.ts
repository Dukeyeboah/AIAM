import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

const PACK_PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.CREDIT_PACK_STARTER_PRICE_ID,
  creator: process.env.CREDIT_PACK_CREATOR_PRICE_ID,
  visionary: process.env.CREDIT_PACK_VISIONARY_PRICE_ID,
};

export async function POST(req: Request) {
  try {
    const { packId, userId } = await req.json();

    if (!packId || !userId) {
      return NextResponse.json(
        { error: 'packId and userId are required' },
        { status: 400 }
      );
    }

    const priceId = PACK_PRICE_IDS[packId];
    if (!priceId) {
      return NextResponse.json(
        { error: `Unknown packId: ${packId}` },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/account?purchase=success`,
      cancel_url: `${baseUrl}/account?purchase=cancel`,
      client_reference_id: userId,
      metadata: {
        userId,
        packId,
      },
    });

    // Return the session URL for direct redirect (new Stripe.js approach)
    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('[stripe] create-checkout-session error', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create checkout session.',
      },
      { status: 500 }
    );
  }
}
