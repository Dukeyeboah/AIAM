import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { admin, adminDb } from '@/lib/firebase/admin';

// Lazy initialization of Resend to avoid build-time errors
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

// Your email address where contact messages should be sent
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'dkyeboah1@gmail.com';

export async function POST(req: Request) {
  try {
    const { userId, userEmail, userName, subject, message } = await req.json();

    if (!userId || !userEmail || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('[contact] RESEND_API_KEY not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    // Store contact message in Firestore
    try {
      await adminDb.collection('contact_messages').add({
        userId,
        userEmail,
        userName: userName || 'Unknown',
        subject: subject || 'Feedback from aiam user',
        message,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'new',
      });
      console.log('[contact] Message stored in Firestore');
    } catch (firestoreError) {
      console.error('[contact] Failed to store in Firestore', firestoreError);
      // Continue even if Firestore fails
    }

    // Send email notification
    const resend = getResend();
    if (!resend) {
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: 'aiam Contact <noreply@reminder.aiam.space>',
      to: CONTACT_EMAIL,
      replyTo: userEmail,
      subject: `[aiam Contact] ${subject || 'User Feedback'}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Contact Form Submission - aiam</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #000; font-size: 28px; margin: 0;">aiam</h1>
              <p style="color: #666; font-size: 14px; margin-top: 5px;">Contact Form Submission</p>
            </div>
            
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <h3 style="margin-top: 0; color: #000; font-size: 18px;">Message Details</h3>
              <div style="margin-bottom: 15px;">
                <strong style="color: #666;">From:</strong>
                <p style="margin: 5px 0 0 0; color: #000;">${
                  userName || 'Unknown User'
                } (${userEmail})</p>
              </div>
              <div style="margin-bottom: 15px;">
                <strong style="color: #666;">Subject:</strong>
                <p style="margin: 5px 0 0 0; color: #000;">${
                  subject || 'Feedback from aiam user'
                }</p>
              </div>
              <div>
                <strong style="color: #666;">Message:</strong>
                <div style="margin-top: 10px; padding: 15px; background: #fff; border-radius: 4px; border: 1px solid #e5e7eb; color: #000; white-space: pre-wrap;">
${message}
                </div>
              </div>
            </div>

            <div style="background: #fff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                <strong>User ID:</strong> ${userId}
              </p>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                <strong>Submitted:</strong> ${new Date().toLocaleString()}
              </p>
            </div>

            <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated email from the aiam contact form.
              </p>
              <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">
                You can reply directly to this email to respond to ${
                  userName || 'the user'
                }.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('[contact] Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send email', details: error },
        { status: 500 }
      );
    }

    console.log('[contact] Contact message sent successfully', {
      userId,
      userEmail,
      messageId: data?.id,
    });

    return NextResponse.json({
      success: true,
      messageId: data?.id,
    });
  } catch (error) {
    console.error('[contact] Error processing contact form:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
