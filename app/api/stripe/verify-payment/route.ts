import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { admin, adminDb } from '@/lib/firebase/admin';

const PACK_CREDITS: Record<string, number> = {
  starter: 500,
  creator: 1200,
  visionary: 2000,
};

// Fallback endpoint to verify payment and add credits if webhook didn't process it
export async function POST(req: Request) {
  try {
    const { sessionId, userId } = await req.json();

    console.log('[stripe-verify-payment] Received request', {
      hasSessionId: !!sessionId,
      hasUserId: !!userId,
      sessionId,
      userId,
    });

    if (!sessionId || !userId) {
      console.error('[stripe-verify-payment] Missing required fields');
      return NextResponse.json(
        { error: 'sessionId and userId are required' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    console.log(
      '[stripe-verify-payment] Retrieving session from Stripe:',
      sessionId
    );
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('[stripe-verify-payment] Session retrieved', {
      id: session.id,
      paymentStatus: session.payment_status,
      metadata: session.metadata,
    });

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        {
          error: 'Payment not completed',
          paymentStatus: session.payment_status,
        },
        { status: 400 }
      );
    }

    // Get packId from metadata
    const packId = session.metadata?.packId;
    if (!packId) {
      return NextResponse.json(
        { error: 'packId not found in session metadata' },
        { status: 400 }
      );
    }

    // Verify userId matches
    if (session.metadata?.userId !== userId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }

    const credits = PACK_CREDITS[packId];
    if (!credits) {
      return NextResponse.json(
        { error: `Unknown packId: ${packId}` },
        { status: 400 }
      );
    }

    // Test Firebase Admin connection
    try {
      const testRef = adminDb.collection('users').doc(userId);
      const testDoc = await testRef.get();
      if (!testDoc.exists) {
        console.error(
          '[stripe-verify-payment] User document does not exist:',
          userId
        );
        return NextResponse.json(
          { error: 'User not found in database' },
          { status: 404 }
        );
      }
      console.log('[stripe-verify-payment] Firebase Admin connection verified');
    } catch (firebaseError) {
      console.error(
        '[stripe-verify-payment] Firebase Admin error:',
        firebaseError
      );
      return NextResponse.json(
        {
          error: 'Database connection failed',
          details:
            firebaseError instanceof Error
              ? firebaseError.message
              : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Check if this payment was already processed (check purchases collection)
    const userRef = adminDb.collection('users').doc(userId);
    const purchasesRef = userRef.collection('purchases');
    console.log(
      '[stripe-verify-payment] Checking for existing purchase with sessionId:',
      sessionId
    );
    const existingPurchase = await purchasesRef
      .where('stripeSessionId', '==', sessionId)
      .limit(1)
      .get();

    if (!existingPurchase.empty) {
      // Payment already processed
      console.log('[stripe-verify-payment] Payment already processed');
      return NextResponse.json({
        success: true,
        message: 'Payment already processed',
        alreadyProcessed: true,
      });
    }

    // Get current credits before transaction
    const userSnapshot = await userRef.get();
    if (!userSnapshot.exists) {
      console.error('[stripe-verify-payment] User not found:', userId);
      throw new Error('User not found');
    }
    const currentCredits =
      (userSnapshot.data()?.credits as number | undefined) ?? 0;
    console.log(
      '[stripe-verify-payment] Current credits:',
      currentCredits,
      'Adding:',
      credits
    );

    // Add credits
    await adminDb.runTransaction(async (tx) => {
      const snapshot = await tx.get(userRef);
      if (!snapshot.exists) {
        throw new Error('User not found');
      }
      const current = (snapshot.data()?.credits as number | undefined) ?? 0;
      const newCredits = current + credits;
      console.log('[stripe-verify-payment] Transaction: updating credits', {
        current,
        credits,
        newCredits,
      });
      tx.update(userRef, {
        credits: newCredits,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    console.log('[stripe-verify-payment] Credits updated successfully');

    // Record purchase
    await purchasesRef.add({
      packId,
      credits,
      amount: session.amount_total,
      currency: session.currency,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      stripeSessionId: sessionId,
      processedVia: 'verify-payment-endpoint', // Mark as processed via fallback
    });

    console.log('[stripe-verify-payment] Purchase recorded successfully');

    return NextResponse.json({
      success: true,
      message: `Added ${credits} credits`,
      creditsAdded: credits,
    });
  } catch (error) {
    console.error('[stripe-verify-payment] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
