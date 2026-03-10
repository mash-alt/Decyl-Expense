const admin = require('firebase-admin');

/**
 * Firebase Admin SDK initialization.
 *
 * Supports two modes:
 *  1. GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON file.
 *  2. Individual env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 *     FIREBASE_PRIVATE_KEY) for environments where a file path isn't practical
 *     (e.g. CI/CD, cloud hosting).
 */

if (!admin.apps.length) {
  const credentialSource = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialSource) {
    // Mode 1 – path to service account JSON file
    const serviceAccount = require(credentialSource);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Mode 2 – individual env vars
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Newlines in private keys are stored as the literal string \n in .env files
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase Admin SDK: missing credentials. ' +
          'Set GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON) ' +
          'or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env'
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  console.log('✅ Firebase Admin SDK initialized');
}

const db = admin.firestore();

module.exports = { admin, db };
