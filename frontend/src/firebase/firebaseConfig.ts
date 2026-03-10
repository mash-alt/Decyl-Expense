import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Initialise only once — prevents duplicate-app errors during hot-reloads
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const db = getFirestore(app)

// ── Connection test (dev only) ─────────────────────────────────────────────
if (import.meta.env.DEV) {
  import('firebase/firestore').then(({ doc, getDoc }) => {
    // A lightweight read attempt; the SDK will throw a clear error if the
    // project ID or credentials are wrong, and confirm the connection otherwise.
    const probe = doc(db, '_connection_test', 'ping')
    getDoc(probe)
      .then(() => console.info('[Firebase] ✓ Firestore connection established'))
      .catch((error: unknown) => {
        if (error instanceof Error && error.message.includes('permission')) {
          // Permission-denied means the connection works — rules just blocked us.
          console.info('[Firebase] ✓ Firestore reachable (permission-denied is expected without auth)')
        } else {
          console.warn('[Firebase] Firestore connection check failed:', error)
        }
      })
  })
}
