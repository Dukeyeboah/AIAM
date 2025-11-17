import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { admin, adminDb } from '@/lib/firebase/admin';
import type Stripe from 'stripe';

const PACK_CREDITS: Record<string, number> = {
  starter: 500,
  creator: 1200,
  visionary: 2000,
};

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: 'Missing webhook signature' },
      { status: 400 }
    );
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const packId = session.metadata?.packId;

    if (!userId || !packId) {
      console.warn('[stripe-webhook] Missing userId or packId in metadata');
      return NextResponse.json({ received: true });
    }

    const credits = PACK_CREDITS[packId];
    if (!credits) {
      console.warn('[stripe-webhook] Unknown packId', packId);
      return NextResponse.json({ received: true });
    }

    try {
      const userRef = adminDb.collection('users').doc(userId);

      await adminDb.runTransaction(async (tx) => {
        const snapshot = await tx.get(userRef);
        const current = (snapshot.data()?.credits as number | undefined) ?? 0;
        tx.update(userRef, {
          credits: current + credits,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Record purchase
      await adminDb
        .collection('users')
        .doc(userId)
        .collection('purchases')
        .add({
          packId,
          credits,
          amount: session.amount_total,
          currency: session.currency,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          stripeSessionId: session.id,
        });
    } catch (err) {
      console.error('[stripe-webhook] Failed to credit user', err);
      return NextResponse.json({ received: true });
    }
  }

  return NextResponse.json({ received: true });
}
