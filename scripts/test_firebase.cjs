const path = require('path');
const frontendNodeModules = path.resolve(__dirname, '..', 'frontend', 'node_modules');

const { initializeApp } = require(path.join(frontendNodeModules, 'firebase', 'app'));
const { getAuth, signInWithEmailAndPassword, signInAnonymously } = require(path.join(frontendNodeModules, 'firebase', 'auth'));
const { getFirestore, collection, getDocs, doc, setDoc } = require(path.join(frontendNodeModules, 'firebase', 'firestore'));

const firebaseConfig = {
  apiKey: "AIzaSyCa6MAtBsFAkAS0fCIv4Jv_qEAFBhjvf-s",
  authDomain: "novapulse-crm.firebaseapp.com",
  projectId: "novapulse-crm",
  storageBucket: "novapulse-crm.firebasestorage.app",
  messagingSenderId: "310409176502",
  appId: "1:310409176502:web:330cc6ee8ea86564850d17"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testAuth() {
  console.log('Testing anonymous sign in...');
  try {
    const cred = await signInAnonymously(auth);
    console.log('Anonymous sign-in SUCCESS! UID:', cred.user.uid);
    await setDoc(doc(db, 'test_migration', 'ping'), { timestamp: new Date().toISOString() });
    console.log('Firestore write SUCCESS!');
    return;
  } catch (e) {
    console.log('Anonymous sign in failed:', e.code, e.message);
  }

  console.log('Testing unauthenticated firestore read...');
  try {
    const snap = await getDocs(collection(db, 'candidates'));
    console.log('Candidates in firestore:', snap.size);
    snap.forEach(d => console.log('Found doc:', d.id));
  } catch (e) {
    console.log('Read failed:', e.code, e.message);
  }
}

testAuth().catch(console.error);
