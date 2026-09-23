// ============================================================
// PLAYER SERVICE — CRUD profils joueurs dans Firestore
// Collection : /players/{userId}
// ============================================================

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';

export interface PlayerProfile {
  userId: string;
  username: string;
  seeds: number;
  completedChallenges: string[];
  stats: {
    totalSolved: number;
    currentStreak: number;
    longestStreak: number;
    bestTimes: Record<string, number>;
  };
  isPremium: boolean;
  createdAt?: any;
  updatedAt?: any;
}

// ── Calcul du niveau courant d'un joueur ──────────────────
// Basé sur le nombre de défis solo complétés : 1 niveau par tranche de 3 défis.
// Niveau 1 minimum, niveau 15 maximum.
export function computePlayerLevel(completedCount: number): number {
  return Math.min(15, Math.max(1, Math.ceil(completedCount / 3)));
}

// ── Résultat de recherche d'ami (avec niveau calculé) ─────
export interface PlayerSearchResult {
  userId: string;
  username: string;
  level: number;         // Niveau calculé du joueur
}

// ── Créer ou mettre à jour le profil ──────────────────────
export async function upsertPlayer(profile: PlayerProfile): Promise<void> {
  const ref = doc(db, 'players', profile.userId);
  await setDoc(ref, {
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Récupérer un profil ────────────────────────────────────
export async function getPlayer(userId: string): Promise<PlayerProfile | null> {
  const ref = doc(db, 'players', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as PlayerProfile;
}

// ── Créer un nouveau profil (premier lancement) ────────────
export async function createPlayer(userId: string, username: string): Promise<PlayerProfile> {
  const profile: PlayerProfile = {
    userId,
    username,
    seeds: 3,
    completedChallenges: [],
    stats: {
      totalSolved: 0,
      currentStreak: 0,
      longestStreak: 0,
      bestTimes: {},
    },
    isPremium: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'players', userId), profile);
  return profile;
}

// ── Mettre à jour les graines ──────────────────────────────
export async function updateSeeds(userId: string, seeds: number): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    seeds,
    updatedAt: serverTimestamp(),
  });
}

// ── Chercher des joueurs par pseudo (avec niveau calculé) ─────────
export async function searchPlayers(
  searchTerm: string,
  excludeUid: string,
  maxResults = 8,
): Promise<PlayerSearchResult[]> {
  if (!searchTerm.trim() || searchTerm.length < 2) return [];

  // Firestore ne supporte pas le LIKE — on simule un préfixe avec >= et <
  const term = searchTerm.trim();
  const termEnd = term.slice(0, -1) + String.fromCharCode(term.charCodeAt(term.length - 1) + 1);

  const q = query(
    collection(db, 'players'),
    where('username', '>=', term),
    where('username', '<', termEnd),
    limit(maxResults),
  );

  const snap = await getDocs(q);
  return snap.docs
    .map(d => d.data() as PlayerProfile)
    .filter(p => p.userId !== excludeUid)
    .map(p => ({
      userId: p.userId,
      username: p.username,
      level: computePlayerLevel(p.completedChallenges?.length ?? 0),
    }));
}

// ── Marquer un défi comme complété ────────────────────────
export async function markCompleted(
  userId: string,
  challengeId: string,
  timeMs: number,
  currentProfile: PlayerProfile
): Promise<void> {
  const alreadyDone = currentProfile.completedChallenges.includes(challengeId);
  const prevBest = currentProfile.stats.bestTimes[challengeId];
  const newBest = prevBest ? Math.min(prevBest, timeMs) : timeMs;

  await updateDoc(doc(db, 'players', userId), {
    completedChallenges: alreadyDone
      ? currentProfile.completedChallenges
      : [...currentProfile.completedChallenges, challengeId],
    'stats.totalSolved': alreadyDone
      ? currentProfile.stats.totalSolved
      : currentProfile.stats.totalSolved + 1,
    [`stats.bestTimes.${challengeId}`]: newBest,
    updatedAt: serverTimestamp(),
  });
}
