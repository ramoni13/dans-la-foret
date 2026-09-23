// ============================================================
// BADGE SERVICE — CRUD Firestore pour les badges joueurs
// Collection : /players/{userId}  (champs earnedBadges, badgeShowcase…)
// ============================================================

import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Ajoute un badge à la liste du joueur de façon atomique (arrayUnion).
 * Sûr contre les écritures concurrentes (offline + reconnexion).
 */
export async function awardBadgeFirestore(
  userId: string,
  badgeId: string
): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    earnedBadges: arrayUnion(badgeId),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Ajoute plusieurs badges en une seule écriture Firestore.
 * Utilise arrayUnion pour éviter les doublons.
 */
export async function awardBadgesFirestore(
  userId: string,
  badgeIds: string[]
): Promise<void> {
  if (badgeIds.length === 0) return;
  await updateDoc(doc(db, 'players', userId), {
    earnedBadges: arrayUnion(...badgeIds),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Récupère la liste des badges d'un joueur (pour affichage profil ami).
 */
export async function getPlayerBadges(userId: string): Promise<string[]> {
  const ref  = doc(db, 'players', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return snap.data().earnedBadges ?? [];
}

/**
 * Récupère la vitrine badges d'un joueur (pour le mode défi amis).
 */
export async function getPlayerBadgeShowcase(userId: string): Promise<string[]> {
  const ref  = doc(db, 'players', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return snap.data().badgeShowcase ?? [];
}

/**
 * Met à jour la vitrine badges (3 emplacements max).
 */
export async function updateBadgeShowcase(
  userId: string,
  showcase: string[]
): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    badgeShowcase: showcase.slice(0, 3),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Synchronise le dailyStreak et lastPlayedDate dans Firestore.
 */
export async function updateDailyStreak(
  userId: string,
  dailyStreak: number,
  lastPlayedDate: string
): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    dailyStreak,
    lastPlayedDate,
    updatedAt: serverTimestamp(),
  });
}
