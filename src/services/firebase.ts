// ============================================================
// FIREBASE — Initialisation unique de l'app Firebase
// Utilise les variables EXPO_PUBLIC_* du fichier .env
// Compatible web + mobile (SDK JS Firebase v9 modulaire)
// ============================================================

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth, browserLocalPersistence } from 'firebase/auth';
// getReactNativePersistence est exporté par @firebase/auth côté React Native
// (Metro résout @firebase/auth vers dist/rn/index.js via le champ "react-native"
//  de son package.json). Sur web, ce symbol n'existe pas dans le bundle web — ok
//  car on ne l'appelle que dans la branche Platform.OS !== 'web'.
// @ts-ignore — absent des types web mais présent dans le bundle RN
import { getReactNativePersistence } from '@firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Persistance explicite :
//   - Mobile (React Native) : AsyncStorage (session survit aux relances de l'app)
//   - Web : localStorage (browserLocalPersistence — comportement par défaut Firebase)
// initializeAuth ne peut être appelé qu'une seule fois par app instance.
// En hot-reload Expo, on utilise try/catch pour récupérer l'instance existante.
function createAuth(firebaseApp: FirebaseApp): Auth {
  if (Platform.OS === 'web') {
    return initializeAuth(firebaseApp, {
      persistence: browserLocalPersistence,
    });
  }
  return initializeAuth(firebaseApp, {
    persistence: (getReactNativePersistence as any)(AsyncStorage),
  });
}

export const auth: Auth = (() => {
  try {
    return createAuth(app);
  } catch {
    // initializeAuth a déjà été appelé (hot-reload) : fallback sur getAuth
    return getAuth(app);
  }
})();

export const db: Firestore = getFirestore(app);
export default app;
