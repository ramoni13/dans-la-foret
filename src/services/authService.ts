// ============================================================
// AUTH SERVICE — Authentification Firebase
// Méthodes : email/password + Google (web) + anonyme
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from './firebase';
import { createPlayer, getPlayer } from './playerService';

// ── Inscription email/password ─────────────────────────────
export async function registerWithEmail(
  email: string,
  password: string,
  username: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: username });
  // Créer le profil Firestore
  await createPlayer(cred.user.uid, username);
  return cred.user;
}

// ── Connexion email/password ───────────────────────────────
export async function loginWithEmail(
  email: string,
  password: string
): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Connexion Google (web uniquement) ─────────────────────
export async function loginWithGoogle(): Promise<User> {
  if (Platform.OS !== 'web') {
    throw new Error('Google Sign-In via popup uniquement sur web. Utilise expo-auth-session sur mobile.');
  }
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);

  // Créer le profil si premier login
  const existing = await getPlayer(cred.user.uid);
  if (!existing) {
    await createPlayer(
      cred.user.uid,
      cred.user.displayName ?? 'Joueur'
    );
  }
  return cred.user;
}

// ── Connexion anonyme (mode invité) ───────────────────────
export async function loginAnonymously(): Promise<User> {
  const cred = await signInAnonymously(auth);
  const existing = await getPlayer(cred.user.uid);
  if (!existing) {
    await createPlayer(cred.user.uid, 'Invité');
  }
  return cred.user;
}

// ── Déconnexion ────────────────────────────────────────────
export async function logout(): Promise<void> {
  await signOut(auth);
}

// ── Observer l'état de connexion ──────────────────────────
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
