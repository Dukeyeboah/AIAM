import { NextResponse } from 'next/server';
import { admin, adminDb } from '@/lib/firebase/admin';

const PACK_CREDITS: Record<string, number> = {
  starter: 500,
  creator: 1200,
  visionary: 2000,
};

// Manual endpoint to add credits (for testing or fixing missed webhooks)
// This should be protected in production - only call from server-side or with auth
export async function POST(req: Request) {
  try {
    const { userId, packId } = await req.json();

    if (!userId || !packId) {
      return NextResponse.json(
        { error: 'userId and packId are required' },
        { status: 400 }
      );
    }

    const credits = PACK_CREDITS[packId];
    if (!credits) {
      return NextResponse.json(
        { error: `Unknown packId: ${packId}` },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentCredits =
      (userSnapshot.data()?.credits as number | undefined) ?? 0;

    await adminDb.runTransaction(async (tx) => {
      const snapshot = await tx.get(userRef);
      const current = (snapshot.data()?.credits as number | undefined) ?? 0;
      const newCredits = current + credits;
      tx.update(userRef, {
        credits: newCredits,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      message: `Added ${credits} credits to user ${userId}`,
      previousCredits: currentCredits,
      newCredits: currentCredits + credits,
    });
  } catch (error) {
    console.error('[stripe-manual-credit] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
