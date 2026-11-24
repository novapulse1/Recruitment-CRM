/**
 * NovaPulse CRM - Firebase Client Configuration
 * 
 * Initializes Firebase Authentication and Cloud Firestore using VITE_FIREBASE_* environment variables.
 * Disallows any local fallback mode if configuration is missing.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '').trim()
};

/**
 * Validates that all required Firebase configuration parameters are present and non-empty.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    !firebaseConfig.apiKey.includes('YOUR_') &&
    firebaseConfig.apiKey.length > 5
  );
}

export function getMissingFirebaseEnvVars(): string[] {
  const missing: string[] = [];
  if (!firebaseConfig.apiKey) missing.push('VITE_FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId) missing.push('VITE_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.storageBucket) missing.push('VITE_FIREBASE_STORAGE_BUCKET');
  if (!firebaseConfig.messagingSenderId) missing.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
  if (!firebaseConfig.appId) missing.push('VITE_FIREBASE_APP_ID');
  return missing;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error('Failed to initialize Firebase App:', error);
  }
}

export { app, auth, db };
