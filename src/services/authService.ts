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
  sendPasswordResetEmail,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from './firebase';
import { createPlayer, getPlayer, isUsernameTaken } from './playerService';

// ── Traduction des codes d'erreur Firebase en messages lisibles ───────────────
export function translateAuthError(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use':    'Un compte existe déjà avec cet e-mail. Utilise "Connexion" ou "Mot de passe oublié" pour récupérer l\'accès.',
    'auth/invalid-email':           'Adresse e-mail invalide.',
    'auth/weak-password':           'Le mot de passe doit contenir au moins 6 caractères.',
    'auth/user-not-found':          'Aucun compte trouvé avec cet e-mail.',
    'auth/wrong-password':          'Mot de passe incorrect.',
    'auth/too-many-requests':       'Trop de tentatives. Réessaie dans quelques minutes.',
    'auth/network-request-failed':  'Erreur réseau. Vérifie ta connexion internet.',
    'auth/user-disabled':           'Ce compte a été désactivé.',
    'auth/invalid-credential':      'Identifiants invalides. Vérifie ton e-mail et ton mot de passe.',
  };
  return map[code] ?? 'Une erreur inattendue est survenue. Réessaie.';
}

// ── Vérifier si une adresse e-mail est déjà utilisée ─────────────────────────
// Retourne true si au moins un compte existe avec cet e-mail.
export async function isEmailAlreadyUsed(email: string): Promise<boolean> {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    return methods.length > 0;
  } catch {
    return false; // En cas d'erreur réseau on ne bloque pas, Firebase le détectera
  }
}

// ── Inscription email/password ─────────────────────────────────────────────────
// Séquence :
//   1. Créer le compte Firebase Auth (l'user est immédiatement authentifié)
//   2. Vérifier l'unicité du pseudo avec les permissions Firestore actives
//   3. Si pseudo pris → supprimer le compte Auth créé et rejeter
//   4. Sinon → créer le profil Firestore
// Cette séquence est nécessaire car les règles Firestore refusent
// les lectures non authentifiées sur /players.
export async function registerWithEmail(
  email: string,
  password: string,
  username: string
): Promise<User> {
  // 1. Créer le compte Firebase Auth
  //    Firebase lève auth/email-already-in-use automatiquement si l'e-mail existe
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch (err: any) {
    throw Object.assign(
      new Error(translateAuthError(err?.code ?? '')),
      { code: err?.code }
    );
  }

  // 2. Vérifier unicité du pseudo (maintenant authentifié → Firestore accepte)
  let pseudoTaken = false;
  try {
    pseudoTaken = await isUsernameTaken(username);
  } catch {
    // Erreur réseau : on continue, le pseudo sera potentiellement dupliqué
    // mais c'est préférable à bloquer l'inscription définitivement
  }

  if (pseudoTaken) {
    // 3. Rollback : supprimer le compte Auth créé
    try { await cred.user.delete(); } catch { /* silencieux */ }
    throw Object.assign(
      new Error('Ce nom de joueur est déjà pris. Choisis-en un autre.'),
      { code: 'app/username-taken' }
    );
  }

  // 4. Mettre à jour le displayName et créer le profil Firestore
  await updateProfile(cred.user, { displayName: username });
  await createPlayer(cred.user.uid, username);
  return cred.user;
}

// ── Connexion email/password ────────────────────────────────────────────────
export async function loginWithEmail(
  email: string,
  password: string
): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err: any) {
    throw Object.assign(
      new Error(translateAuthError(err?.code ?? '')),
      { code: err?.code }
    );
  }
}

// ── Mot de passe oublié ─────────────────────────────────────────────────────
// Envoie un e-mail de réinitialisation via Firebase Auth.
export async function sendPasswordReset(email: string): Promise<void> {
  if (!email.trim()) {
    throw new Error('Saisis ton adresse e-mail pour recevoir le lien.');
  }
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err: any) {
    throw Object.assign(
      new Error(translateAuthError(err?.code ?? '')),
      { code: err?.code }
    );
  }
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
