import { NextResponse } from 'next/server';
import { admin, adminDb } from '@/lib/firebase/admin';
import { sendWeeklySummaryEmail, type AffirmationData } from '@/lib/email';

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

    console.log('[cron-weekly-summary] Starting weekly summary email job');

    // Calculate date range for this week (last 7 days)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
        console.log(`[cron-weekly-summary] Skipping user ${userId} - no email`);
        continue;
      }

      try {
        // Get affirmations from this week
        const weekAgoTimestamp = admin.firestore.Timestamp.fromDate(weekAgo);
        const thisWeekAffirmationsSnapshot = await adminDb
          .collection('users')
          .doc(userId)
          .collection('affirmations')
          .where('createdAt', '>=', weekAgoTimestamp)
          .get();

        let selectedAffirmations: AffirmationData[] = [];

        if (!thisWeekAffirmationsSnapshot.empty) {
          // Use affirmations from this week
          selectedAffirmations = thisWeekAffirmationsSnapshot.docs.map(
            (doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                affirmation: data.affirmation || '',
                categoryTitle: data.categoryTitle || '',
                imageUrl: data.imageUrl || null,
              };
            }
          );

          // Shuffle and take 7
          const shuffled = [...selectedAffirmations].sort(
            () => Math.random() - 0.5
          );
          selectedAffirmations = shuffled.slice(0, 7);
        } else {
          // No affirmations this week, get random 7 from past
          const allAffirmationsSnapshot = await adminDb
            .collection('users')
            .doc(userId)
            .collection('affirmations')
            .get();

          if (allAffirmationsSnapshot.empty) {
            console.log(
              `[cron-weekly-summary] Skipping user ${userId} - no affirmations at all`
            );
            continue;
          }

          const allAffirmations: AffirmationData[] =
            allAffirmationsSnapshot.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                affirmation: data.affirmation || '',
                categoryTitle: data.categoryTitle || '',
                imageUrl: data.imageUrl || null,
              };
            });

          // Shuffle and take 7
          const shuffled = [...allAffirmations].sort(() => Math.random() - 0.5);
          selectedAffirmations = shuffled.slice(0, 7);
        }

        if (selectedAffirmations.length === 0) {
          console.log(
            `[cron-weekly-summary] Skipping user ${userId} - no affirmations to send`
          );
          continue;
        }

        // Send email
        const result = await sendWeeklySummaryEmail(
          userEmail,
          userName,
          selectedAffirmations
        );

        if (result.success) {
          successCount++;
          console.log(
            `[cron-weekly-summary] Email sent successfully to ${userEmail}`
          );
        } else {
          errorCount++;
          errors.push(`${userEmail}: ${result.error}`);
          console.error(
            `[cron-weekly-summary] Failed to send email to ${userEmail}:`,
            result.error
          );
        }
      } catch (error) {
        errorCount++;
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${userEmail}: ${errorMsg}`);
        console.error(
          `[cron-weekly-summary] Error processing user ${userId}:`,
          error
        );
      }
    }

    console.log('[cron-weekly-summary] Job completed', {
      successCount,
      errorCount,
      totalUsers: usersSnapshot.size,
    });

    return NextResponse.json({
      success: true,
      message: 'Weekly summary email job completed',
      stats: {
        successCount,
        errorCount,
        totalUsers: usersSnapshot.size,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[cron-weekly-summary] Job failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
