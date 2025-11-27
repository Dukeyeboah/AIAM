import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { admin, adminDb } from '@/lib/firebase/admin';
import { sendPurchaseConfirmationEmail } from '@/lib/email';
import type Stripe from 'stripe';

const PACK_CREDITS: Record<string, number> = {
  starter: 500,
  creator: 1200,
  visionary: 2000,
};

// Disable body parsing - we need raw body for signature verification
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('[stripe-webhook] Received webhook request', {
    hasSignature: !!sig,
    hasSecret: !!webhookSecret,
  });

  if (!sig || !webhookSecret) {
    console.error('[stripe-webhook] Missing signature or secret', {
      hasSignature: !!sig,
      hasSecret: !!webhookSecret,
    });
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

  console.log('[stripe-webhook] Event type:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const packId = session.metadata?.packId;

    console.log('[stripe-webhook] Processing checkout.session.completed', {
      sessionId: session.id,
      userId,
      packId,
      metadata: session.metadata,
    });

    if (!userId || !packId) {
      console.error('[stripe-webhook] Missing userId or packId in metadata', {
        userId,
        packId,
        metadata: session.metadata,
      });
      return NextResponse.json({ received: true });
    }

    const credits = PACK_CREDITS[packId];
    if (!credits) {
      console.error('[stripe-webhook] Unknown packId', {
        packId,
        availablePacks: Object.keys(PACK_CREDITS),
      });
      return NextResponse.json({ received: true });
    }

    console.log('[stripe-webhook] Adding credits', { userId, packId, credits });

    try {
      const userRef = adminDb.collection('users').doc(userId);

      // First check if user exists
      const userSnapshot = await userRef.get();
      if (!userSnapshot.exists) {
        console.error('[stripe-webhook] User document does not exist', {
          userId,
        });
        return NextResponse.json({ received: true });
      }

      const currentCredits =
        (userSnapshot.data()?.credits as number | undefined) ?? 0;
      console.log(
        '[stripe-webhook] Current credits:',
        currentCredits,
        'Adding:',
        credits
      );

      await adminDb.runTransaction(async (tx) => {
        const snapshot = await tx.get(userRef);
        const current = (snapshot.data()?.credits as number | undefined) ?? 0;
        const newCredits = current + credits;
        console.log('[stripe-webhook] Transaction: updating credits', {
          current,
          credits,
          newCredits,
        });
        tx.update(userRef, {
          credits: newCredits,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      console.log('[stripe-webhook] Credits updated successfully');

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

      console.log('[stripe-webhook] Purchase recorded successfully');

      // Send purchase confirmation email (non-blocking)
      sendPurchaseConfirmationEmail(userId, packId).catch((emailError) => {
        console.warn(
          '[stripe-webhook] Email sending error (non-critical):',
          emailError
        );
        // Don't fail the webhook if email fails
      });
    } catch (err) {
      console.error('[stripe-webhook] Failed to credit user', err);
      // Don't return error - Stripe will retry if we return an error
      // But log it so we can debug
      return NextResponse.json({
        received: true,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  } else {
    console.log('[stripe-webhook] Ignoring event type:', event.type);
  }

  return NextResponse.json({ received: true });
}
