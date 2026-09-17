// ============================================================
// FIREBASE — Initialisation unique de l'app Firebase
// Utilise les variables EXPO_PUBLIC_* du fichier .env
// Compatible web + mobile (SDK JS Firebase v9 modulaire)
// ============================================================

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Les clés Firebase sont publiques côté client (sécurité via règles Firestore)
const firebaseConfig = {
  apiKey: 'AIzaSyAsHZt8rxQz-Ckyd1riKFKhYmCCemCTlMI',
  authDomain: 'danslaforet-c9f83.firebaseapp.com',
  projectId: 'danslaforet-c9f83',
  storageBucket: 'danslaforet-c9f83.firebasestorage.app',
  messagingSenderId: '351028267373',
  appId: '1:351028267373:web:929a44dd218cb42feb3264',
  measurementId: 'G-68JW1F6C07',
};

// Évite la double initialisation en mode hot-reload
const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export default app;
