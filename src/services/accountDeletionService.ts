// ============================================================
// SUPPRESSION DE COMPTE PAR LE JOUEUR (droit à l'effacement, exigence Apple / Google Play)
//
// `deleteMyAccount({ password })` :
//   1. ré-authentifie le joueur (mot de passe, ou popup Google sur le web) ;
//   2. efface ses données Firestore selon `buildDeletionPlan` (src/constants/accountDeletion.ts) ;
//   3. supprime le compte Firebase Auth (`deleteUser`), EN DERNIER ;
//   4. efface les données locales (AsyncStorage) — le store est remis à zéro par l'appelant.
//
// Les données « personnelles uniquement » (`players`, `leaderboard`, `metrics`) DOIVENT être effacées : si l'une
// échoue, on s'arrête AVANT de supprimer le compte Auth (le joueur peut réessayer). Les autres cibles (résultats du
// Journalier, défis amis, records, jackpot) dépendent des règles Firestore et d'un index de groupe de collections :
// en cas d'échec, la suppression continue et la cible est renvoyée dans `residual` (traitée à la main sur demande
// à CONTACT_EMAIL). Voir docs/rgpd-stores.md pour les règles et l'index à configurer.
// ============================================================

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from './firebase';
import {
  DELETION_LOCAL_KEYS,
  DELETION_UID_DOCS,
  buildDeletionPlan,
  chunk,
  describeTarget,
  getReauthMethod,
  type DeletionTarget,
  type ReauthMethod,
} from '../constants/accountDeletion';

export interface DeletionResult {
  /** Cibles non critiques qui n'ont pas pu être effacées (à traiter manuellement). */
  residual: string[];
}

/** Méthode de ré-authentification du joueur connecté (l'écran affiche un champ mot de passe si 'password'). */
export function getCurrentReauthMethod(): ReauthMethod {
  const user = auth.currentUser;
  if (!user) return 'none';
  return getReauthMethod(user.providerData.map(p => p.providerId));
}

async function reauthenticate(user: User, password: string | undefined): Promise<void> {
  const method = getReauthMethod(user.providerData.map(p => p.providerId));
  if (method === 'password') {
    if (!user.email || !password) throw Object.assign(new Error('missing password'), { code: 'auth/missing-password' });
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else if (method === 'google' && Platform.OS === 'web') {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  }
  // 'none' (compte anonyme) : rien à faire ; si la session est trop ancienne, deleteUser renverra
  // auth/requires-recent-login et le joueur devra se reconnecter.
}

async function collectRefs(target: DeletionTarget): Promise<DocumentReference[]> {
  switch (target.kind) {
    case 'doc':
      return [doc(db, target.collection, target.id)];
    case 'query': {
      const snap = await getDocs(query(collection(db, target.collection), where(target.field, '==', target.value)));
      return snap.docs.map(d => d.ref);
    }
    case 'group_query': {
      const snap = await getDocs(query(collectionGroup(db, target.group), where(target.field, '==', target.value)));
      return snap.docs.map(d => d.ref);
    }
  }
}

async function deleteRefs(refs: DocumentReference[]): Promise<void> {
  if (refs.length === 1) { await deleteDoc(refs[0]); return; }
  for (const part of chunk(refs)) {
    const batch = writeBatch(db);
    for (const ref of part) batch.delete(ref);
    await batch.commit();
  }
}

function isCritical(target: DeletionTarget): boolean {
  return target.kind === 'doc' && DELETION_UID_DOCS.includes(target.collection);
}

/**
 * Efface les données Firestore de `uid` selon `buildDeletionPlan` (profil `players/{uid}` en dernier).
 * Lève une erreur si une cible critique (`players`, `leaderboard`, `metrics`) échoue ; renvoie les cibles non
 * critiques restées en place. Utilisé par la suppression par le joueur ET par la purge des comptes inactifs
 * (`inactiveAccountService.ts`).
 */
export async function eraseAccountData(uid: string): Promise<string[]> {
  const residual: string[] = [];
  for (const target of buildDeletionPlan(uid)) {
    try {
      const refs = await collectRefs(target);
      if (refs.length > 0) await deleteRefs(refs);
    } catch (err) {
      if (isCritical(target)) throw err;
      console.warn('[accountDeletion] cible non effacée :', describeTarget(target), err);
      residual.push(describeTarget(target));
    }
  }
  return residual;
}

/**
 * Supprime définitivement le compte du joueur connecté et ses données.
 * Lève une erreur (avec `code` Firebase) si la ré-authentification ou une suppression critique échoue :
 * dans ce cas le compte Auth n'est PAS supprimé.
 */
export async function deleteMyAccount(opts: {
  password?: string;
  /**
   * Appelé après l'effacement Firestore, juste AVANT `deleteUser` : l'appelant y remet le store à zéro
   * (`playerStore.logout()`). Sinon les synchronisations différées de `(tabs)/_layout.tsx` (statistiques,
   * classement), qui se vident au changement de compte, réécriraient le profil qu'on vient d'effacer.
   */
  beforeAuthDelete?: () => void;
} = {}): Promise<DeletionResult> {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('not signed in'), { code: 'auth/no-current-user' });

  await reauthenticate(user, opts.password);

  const residual = await eraseAccountData(user.uid);

  opts.beforeAuthDelete?.();
  try {
    await deleteUser(user);
  } catch (err) {
    // Très rare (la ré-authentification vient d'avoir lieu) : les données sont déjà effacées. On déconnecte pour
    // ne pas laisser une session sans profil ; le joueur peut se reconnecter et relancer la suppression.
    await signOut(auth).catch(() => {});
    throw err;
  }

  try {
    await AsyncStorage.multiRemove([...DELETION_LOCAL_KEYS]);
  } catch {
    // Le store est remis à zéro par l'appelant ; la prochaine sauvegarde écrasera l'état local.
  }

  return { residual };
}
