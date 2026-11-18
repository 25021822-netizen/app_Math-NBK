import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const secretApiKey = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
const resolvedFirebaseConfig = secretApiKey
  ? { ...firebaseConfig, apiKey: secretApiKey }
  : firebaseConfig;

export const app = initializeApp(resolvedFirebaseConfig);
export const db = getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
