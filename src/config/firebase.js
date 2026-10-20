import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Firebase is used ONLY as the database (Firestore). Authentication is our own JWT.
function loadCredential() {
  // Option 1 (best for Vercel): the whole service-account JSON pasted into one env variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    json.private_key = json.private_key?.replace(/\\n/g, '\n');
    return cert(json);
  }
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (keyPath && fs.existsSync(path.resolve(keyPath))) {
    return cert(JSON.parse(fs.readFileSync(path.resolve(keyPath), 'utf8')));
  }
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }
  // Throw (not process.exit) so serverless platforms log a clear error.
  throw new Error(
    'Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT (full JSON), or FIREBASE_SERVICE_ACCOUNT_PATH, ' +
      'or FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.'
  );
}

if (!getApps().length) {
  // Local Firestore emulator (firebase emulators:start --only firestore) needs no credentials.
  if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-shop' });
  else initializeApp({ credential: loadCredential() });
}

export const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

export { FieldValue };

export const col = {
  users: () => db.collection('users'),
  categories: () => db.collection('categories'),
  products: () => db.collection('products'),
  banners: () => db.collection('banners'),
  orders: () => db.collection('orders'),
  reviews: () => db.collection('reviews'),
};

export const docData = (doc) => (doc.exists ? { id: doc.id, ...doc.data() } : null);
export const snapData = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
