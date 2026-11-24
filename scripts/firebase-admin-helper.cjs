/**
 * Shared Firebase Helper for Node scripts
 */
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', 'frontend', '.env.local');
const config = {};

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      config[key] = val;
    }
  });
}

const { initializeApp } = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'firebase', 'app'));
const {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch
} = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'firebase', 'firestore'));
const {
  getAuth,
  signInWithEmailAndPassword
} = require(path.resolve(__dirname, '..', 'frontend', 'node_modules', 'firebase', 'auth'));

const app = initializeApp({
  apiKey: config.VITE_FIREBASE_API_KEY,
  authDomain: config.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: config.VITE_FIREBASE_PROJECT_ID,
  storageBucket: config.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: config.VITE_FIREBASE_APP_ID
});

const db = getFirestore(app);
const auth = getAuth(app);

module.exports = {
  app,
  db,
  auth,
  config,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  signInWithEmailAndPassword
};
