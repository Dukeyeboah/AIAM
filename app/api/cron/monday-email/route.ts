import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendMondayMotivationalEmail, type AffirmationData } from '@/lib/email';

// Verify the request is from Vercel Cron
function verifyCronRequest(req: Request): boolean {
  // Vercel automatically adds this header for cron jobs
  const cronHeader = req.headers.get('x-vercel-cron');
  // Also allow manual testing with a secret
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (cronHeader) {
    return true; // Verified by Vercel
  }

  // For manual testing, allow with secret
  if (secret && authHeader === `Bearer ${secret}`) {
    return true;
  }

  return false;
}

export async function GET(req: Request) {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[cron-monday-email] Starting Monday email job');

    // Get all users with email addresses
    const usersSnapshot = await adminDb.collection('users').get();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userEmail = userData?.email;
      const userName = userData?.displayName || null;
      const userId = userDoc.id;

      if (!userEmail) {
        console.log(`[cron-monday-email] Skipping user ${userId} - no email`);
        continue;
      }

      try {
        // Get user's affirmations
        const affirmationsSnapshot = await adminDb
          .collection('users')
          .doc(userId)
          .collection('affirmations')
          .get();

        if (affirmationsSnapshot.empty) {
          console.log(
            `[cron-monday-email] Skipping user ${userId} - no affirmations`
          );
          continue;
        }

        // Convert to AffirmationData format
        const allAffirmations: AffirmationData[] =
          affirmationsSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              affirmation: data.affirmation || '',
              categoryTitle: data.categoryTitle || '',
              imageUrl: data.imageUrl || null,
            };
          });

        // Shuffle and take 3 (or at least 1 if less than 3)
        const shuffled = [...allAffirmations].sort(() => Math.random() - 0.5);
        const selectedAffirmations =
          shuffled.length >= 3
            ? shuffled.slice(0, 3)
            : shuffled.slice(0, Math.max(1, shuffled.length));

        // Send email
        const result = await sendMondayMotivationalEmail(
          userEmail,
          userName,
          selectedAffirmations
        );

        if (result.success) {
          successCount++;
          console.log(
            `[cron-monday-email] Email sent successfully to ${userEmail}`
          );
        } else {
          errorCount++;
          errors.push(`${userEmail}: ${result.error}`);
          console.error(
            `[cron-monday-email] Failed to send email to ${userEmail}:`,
            result.error
          );
        }
      } catch (error) {
        errorCount++;
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${userEmail}: ${errorMsg}`);
        console.error(
          `[cron-monday-email] Error processing user ${userId}:`,
          error
        );
      }
    }

    console.log('[cron-monday-email] Job completed', {
      successCount,
      errorCount,
      totalUsers: usersSnapshot.size,
    });

    return NextResponse.json({
      success: true,
      message: 'Monday email job completed',
      stats: {
        successCount,
        errorCount,
        totalUsers: usersSnapshot.size,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[cron-monday-email] Job failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
