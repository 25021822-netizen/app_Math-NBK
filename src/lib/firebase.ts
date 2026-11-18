import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const runtimeSecretKey =
  typeof window !== 'undefined' &&
  typeof (window as Window & { __RUNTIME_FIREBASE_API_KEY__?: unknown }).__RUNTIME_FIREBASE_API_KEY__ === 'string'
    ? ((window as Window & { __RUNTIME_FIREBASE_API_KEY__?: string }).__RUNTIME_FIREBASE_API_KEY__ || '').trim()
    : '';
const buildSecretKey = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
const fallbackKey = ((firebaseConfig as { apiKey?: string }).apiKey || '').trim();
const resolvedApiKey = runtimeSecretKey || buildSecretKey || fallbackKey;

const resolvedFirebaseConfig = {
  ...firebaseConfig,
  apiKey: resolvedApiKey,
};

export const app = initializeApp(resolvedFirebaseConfig);
export const db = getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
