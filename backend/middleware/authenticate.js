const { admin } = require('../firebase/firebaseAdmin');

/**
 * Express middleware that verifies a Firebase ID token sent in the
 * `Authorization: Bearer <token>` header.
 *
 * On success, attaches `req.uid` (the Firebase UID) and calls next().
 * On failure, responds with 401 JSON.
 */
module.exports = async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const idToken = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.error('[authenticate] Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
  }
};
