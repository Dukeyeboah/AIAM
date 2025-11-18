import admin from 'firebase-admin';

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [];
    if (!projectId) missing.push('FIREBASE_PROJECT_ID');
    if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
    throw new Error(
      `[firebase-admin] Missing environment variables: ${missing.join(', ')}`
    );
  }

  // Handle private key formatting
  // Remove quotes if present (from JSON copy-paste)
  privateKey = privateKey.replace(/^["']|["']$/g, '');
  // Replace escaped newlines with actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
  // If it doesn't have BEGIN/END markers, it might be malformed
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    console.warn(
      '[firebase-admin] Private key may be malformed - missing BEGIN PRIVATE KEY marker'
    );
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log('[firebase-admin] Initialized successfully');
  } catch (error) {
    console.error('[firebase-admin] Initialization failed:', error);
    throw error;
  }
}

export const adminDb = admin.firestore();
export { admin };
