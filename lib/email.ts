import { Resend } from 'resend';
import { adminDb } from '@/lib/firebase/admin';

const resend = new Resend(process.env.RESEND_API_KEY);

const PACK_INFO: Record<
  string,
  { title: string; price: string; credits: number }
> = {
  starter: {
    title: 'Starter',
    price: '$4.99',
    credits: 500,
  },
  creator: {
    title: 'Creator',
    price: '$9.99',
    credits: 1200,
  },
  visionary: {
    title: 'Visionary',
    price: '$16.99',
    credits: 2000,
  },
};

export async function sendPurchaseConfirmationEmail(
  userId: string,
  packId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[email] RESEND_API_KEY not configured, skipping email');
      return { success: false, error: 'Email service not configured' };
    }

    // Get user email from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { success: false, error: 'User not found' };
    }

    const userData = userDoc.data();
    const userEmail = userData?.email;

    if (!userEmail) {
      console.log('[email] User has no email address');
      return { success: false, error: 'User has no email' };
    }

    const packInfo = PACK_INFO[packId];
    if (!packInfo) {
      return { success: false, error: `Unknown packId: ${packId}` };
    }

    // Send email
    const { data, error } = await resend.emails.send({
      from: 'aiam <noreply@reminder.aiam.space>',
      to: userEmail,
      subject: `Your ${packInfo.title} Pack Purchase - ${packInfo.credits} aiams Added!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Purchase Confirmation - aiam</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #000; font-size: 28px; margin: 0;">aiam</h1>
              <p style="color: #666; font-size: 14px; margin-top: 5px;">Affirmations for Your Self Actualization</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; color: white; text-align: center; margin-bottom: 30px;">
              <h2 style="margin: 0 0 10px 0; font-size: 24px;">Purchase Successful! ✨</h2>
              <p style="margin: 0; font-size: 16px; opacity: 0.95;">Your aiams have been added to your account</p>
            </div>

            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <h3 style="margin-top: 0; color: #000; font-size: 18px;">Purchase Details</h3>
              <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #666;">Pack:</span>
                <span style="font-weight: 600; color: #000;">${
                  packInfo.title
                }</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #666;">Aiams Added:</span>
                <span style="font-weight: 600; color: #000;">${packInfo.credits.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                <span style="color: #666;">Amount Paid:</span>
                <span style="font-weight: 600; color: #000;">${
                  packInfo.price
                }</span>
              </div>
            </div>

            <div style="background: #fff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
              <p style="margin: 0 0 15px 0; font-size: 16px; color: #000; line-height: 1.7;">
                You're now ready to generate more personalized affirmations to aid your journey of self-actualization and program your subconscious mind toward creating the reality of your dreams.
              </p>
              <p style="margin: 0; font-size: 16px; color: #000; line-height: 1.7;">
                Every "I am" you speak is a command to your reality — a vibration that shapes your future. Use your aiams to design affirmations that reflect the person you wish to become, visualize your future self, and imprint it deeply through repetition and positive emotion.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.aiam.space" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Continue Your Journey →
              </a>
            </div>

            <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated email. Please do not reply to this message.
              </p>
              <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">
                © ${new Date().getFullYear()} aiam. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return { success: false, error: error.message || 'Failed to send email' };
    }

    console.log('[email] Purchase confirmation email sent successfully', {
      userId,
      packId,
      email: userEmail,
      messageId: data?.id,
    });

    return { success: true };
  } catch (error) {
    console.error('[email] Error sending purchase confirmation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

interface AffirmationData {
  id: string;
  affirmation: string;
  categoryTitle: string;
  imageUrl: string | null;
}

export async function sendMondayMotivationalEmail(
  userEmail: string,
  userName: string | null,
  affirmations: AffirmationData[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[email] RESEND_API_KEY not configured, skipping email');
      return { success: false, error: 'Email service not configured' };
    }

    if (affirmations.length === 0) {
      return { success: false, error: 'No affirmations to send' };
    }

    const firstName = userName?.split(' ')[0] || 'Friend';
    const affirmationCount = affirmations.length;

    // Build affirmation HTML with images
    const affirmationsHtml = affirmations
      .map((aff, index) => {
        const imageHtml = aff.imageUrl
          ? `<img src="${aff.imageUrl}" alt="Affirmation visualization" style="width: 100%; max-width: 500px; height: auto; border-radius: 8px; margin-bottom: 15px; display: block;" />`
          : '';
        return `
          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            ${imageHtml}
            <p style="font-size: 18px; font-weight: 600; color: #000; line-height: 1.6; margin: 0; text-align: center;">
              "${aff.affirmation}"
            </p>
            ${
              aff.categoryTitle
                ? `<p style="color: #666; font-size: 14px; margin-top: 10px; text-align: center; margin-bottom: 0;">${aff.categoryTitle}</p>`
                : ''
            }
          </div>
        `;
      })
      .join('');

    const { data, error } = await resend.emails.send({
      from: 'aiam <noreply@reminder.aiam.space>',
      to: userEmail,
      subject: `Start Your Week with Purpose - ${affirmationCount} Affirmation${
        affirmationCount > 1 ? 's' : ''
      } for You ✨`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Start Your Week with Purpose - aiam</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #000; font-size: 28px; margin: 0;">aiam</h1>
              <p style="color: #666; font-size: 14px; margin-top: 5px;">Affirmations for Your Self Actualization</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; color: white; text-align: center; margin-bottom: 30px;">
              <h2 style="margin: 0 0 10px 0; font-size: 24px;">Start Your Week with Purpose, ${firstName} ✨</h2>
              <p style="margin: 0; font-size: 16px; opacity: 0.95;">Your affirmations for this week</p>
            </div>

            <div style="background: #fff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
              <p style="margin: 0 0 15px 0; font-size: 16px; color: #000; line-height: 1.7;">
                As you begin this new week, remember that every "I am" you speak is a command to your reality — a vibration that shapes your future. Repeat these affirmations with conviction, knowing, and heightened emotion. Feel the positive vibration and power within you, knowing that you are getting closer to manifesting your new reality this week.
              </p>
              <p style="margin: 0; font-size: 16px; color: #000; line-height: 1.7;">
                This is your time to stay in vibrational alignment with your new reality. You have the power within you to create the life you desire, and it begins with affirming that it is already done.
              </p>
            </div>

            <div style="margin-bottom: 30px;">
              <h3 style="color: #000; font-size: 20px; margin-bottom: 20px; text-align: center;">Your Affirmations for This Week</h3>
              ${affirmationsHtml}
            </div>

            <div style="background: #fff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
              <p style="margin: 0 0 15px 0; font-size: 16px; color: #000; line-height: 1.7; font-weight: 600;">
                The Power of "I AM"
              </p>
              <p style="margin: 0 0 15px 0; font-size: 16px; color: #000; line-height: 1.7;">
                The words "I AM" connect you directly to the source of all things and all creation — God, infinite intelligence, the I AM. When you speak these words with conviction, you tap into your divine creative power.
              </p>
              <p style="margin: 0; font-size: 16px; color: #000; line-height: 1.7;">
                We are here to help you fuel and tap into this divine power. Visit aiam to create more affirmations and repeat them with purpose, knowing that achieving all your goals is possible. You are the creator of your reality.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.aiam.space" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Create More Affirmations →
              </a>
            </div>

            <div style="background: #f0f9ff; border-left: 4px solid #667eea; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <p style="margin: 0; font-size: 16px; color: #000; line-height: 1.7; font-style: italic;">
                "You will achieve whatever you set your mind to, and it begins with affirming that it is already done. This week, use the app to generate affirmations for the life you want to live. This is all part of the work to help you tap into your creative power. We are here to support you in achieving your dreams into reality."
              </p>
            </div>

            <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated email. Please do not reply to this message.
              </p>
              <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">
                © ${new Date().getFullYear()} aiam. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return { success: false, error: error.message || 'Failed to send email' };
    }

    console.log('[email] Monday motivational email sent successfully', {
      email: userEmail,
      affirmationCount,
      messageId: data?.id,
    });

    return { success: true };
  } catch (error) {
    console.error('[email] Error sending Monday motivational email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function sendWeeklySummaryEmail(
  userEmail: string,
  userName: string | null,
  affirmations: AffirmationData[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[email] RESEND_API_KEY not configured, skipping email');
      return { success: false, error: 'Email service not configured' };
    }

    if (affirmations.length === 0) {
      return { success: false, error: 'No affirmations to send' };
    }

    const firstName = userName?.split(' ')[0] || 'Friend';

    // Build affirmation HTML with images
    const affirmationsHtml = affirmations
      .map((aff, index) => {
        const imageHtml = aff.imageUrl
          ? `<img src="${aff.imageUrl}" alt="Affirmation visualization" style="width: 100%; max-width: 500px; height: auto; border-radius: 8px; margin-bottom: 15px; display: block;" />`
          : '';
        return `
          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            ${imageHtml}
            <p style="font-size: 18px; font-weight: 600; color: #000; line-height: 1.6; margin: 0; text-align: center;">
              "${aff.affirmation}"
            </p>
            ${
              aff.categoryTitle
                ? `<p style="color: #666; font-size: 14px; margin-top: 10px; text-align: center; margin-bottom: 0;">${aff.categoryTitle}</p>`
                : ''
            }
          </div>
        `;
      })
      .join('');

    const { data, error } = await resend.emails.send({
      from: 'aiam <noreply@reminder.aiam.space>',
      to: userEmail,
      subject: `Your Weekly Affirmations - ${affirmations.length} to Visualize Your Dream Life ✨`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Weekly Affirmations - aiam</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #000; font-size: 28px; margin: 0;">aiam</h1>
              <p style="color: #666; font-size: 14px; margin-top: 5px;">Affirmations for Your Self Actualization</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; color: white; text-align: center; margin-bottom: 30px;">
              <h2 style="margin: 0 0 10px 0; font-size: 24px;">Your Weekly Affirmations, ${firstName} ✨</h2>
              <p style="margin: 0; font-size: 16px; opacity: 0.95;">Visualize your dream life into reality</p>
            </div>

            <div style="background: #fff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
              <p style="margin: 0 0 15px 0; font-size: 16px; color: #000; line-height: 1.7;">
                Here are ${
                  affirmations.length
                } affirmations to help you visualize your dream life into reality this week. The repetition and conviction will empower and speed up your creation, shifting your reality to make you your new self.
              </p>
              <p style="margin: 0; font-size: 16px; color: #000; line-height: 1.7;">
                Come to the app and generate more affirmations weekly. Each affirmation you create and repeat brings you closer to the life you desire. You have the power to create your reality.
              </p>
            </div>

            <div style="margin-bottom: 30px;">
              <h3 style="color: #000; font-size: 20px; margin-bottom: 20px; text-align: center;">Your Affirmations</h3>
              ${affirmationsHtml}
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.aiam.space" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Generate More Affirmations →
              </a>
            </div>

            <div style="background: #f0f9ff; border-left: 4px solid #667eea; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <p style="margin: 0; font-size: 16px; color: #000; line-height: 1.7; font-style: italic;">
                "The repetition and conviction will empower and speed up your creation, creating your reality by shifting your reality to make you your new self. Generate more affirmations weekly to visualize your dream life into reality."
              </p>
            </div>

            <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated email. Please do not reply to this message.
              </p>
              <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">
                © ${new Date().getFullYear()} aiam. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return { success: false, error: error.message || 'Failed to send email' };
    }

    console.log('[email] Weekly summary email sent successfully', {
      email: userEmail,
      affirmationCount: affirmations.length,
      messageId: data?.id,
    });

    return { success: true };
  } catch (error) {
    console.error('[email] Error sending weekly summary email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
