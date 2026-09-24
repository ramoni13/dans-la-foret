// ============================================================
// LEADERBOARD SERVICE
// Collection Firestore : /leaderboard/{userId}
//
// Score composite pour tri global :
//   score = level * 10000000 + badgeCount * 10000 + seeds
//
// Priorité : niveau → badges → graines
// Mise à jour à chaque victoire (upsert avec merge).
// ============================================================

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { computePlayerLevel } from './playerService';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  level: number;               // 1-15
  badgeCount: number;          // badges non-secrets
  seeds: number;
  completedCount: number;      // total défis complétés
  score: number;               // score composite pour tri
  updatedAt?: any;
}

const COLLECTION = 'leaderboard';

// ── Calculer le score composite ───────────────────────────────────────────────
export function computeLeaderboardScore(level: number, badgeCount: number, seeds: number): number {
  return level * 10000000 + badgeCount * 10000 + seeds;
}

// ── Mettre à jour l'entrée du joueur courant ──────────────────────────────────
// Appelée à chaque victoire depuis [challengeId].tsx
export async function upsertLeaderboardEntry(
  userId: string,
  username: string,
  completedCount: number,
  badgeCount: number,
  seeds: number,
): Promise<void> {
  try {
    const level = computePlayerLevel(completedCount);
    const score = computeLeaderboardScore(level, badgeCount, seeds);
    const ref   = doc(db, COLLECTION, userId);
    await setDoc(ref, {
      userId,
      username,
      level,
      badgeCount,
      seeds,
      completedCount,
      score,
      updatedAt: new Date(),
    }, { merge: true });
  } catch {
    // Silencieux : ne bloque pas la progression locale
  }
}

// ── Lire le top N du classement ───────────────────────────────────────────────
export async function getTopLeaderboard(maxCount = 50): Promise<LeaderboardEntry[]> {
  try {
    const ref  = collection(db, COLLECTION);
    const q    = query(ref, orderBy('score', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as LeaderboardEntry);
  } catch {
    return [];
  }
}

// ── Écouter le classement en temps réel ──────────────────────────────────────
export function subscribeLeaderboard(
  maxCount = 50,
  onChange: (entries: LeaderboardEntry[]) => void,
): Unsubscribe {
  const ref = collection(db, COLLECTION);
  const q   = query(ref, orderBy('score', 'desc'), limit(maxCount));
  return onSnapshot(q, snap => {
    onChange(snap.docs.map(d => d.data() as LeaderboardEntry));
  }, () => onChange([]));
}

// ── Lire la position d'un joueur dans le classement ──────────────────────────
export async function getPlayerRank(userId: string): Promise<{ rank: number; total: number } | null> {
  try {
    const myRef  = doc(db, COLLECTION, userId);
    const mySnap = await getDoc(myRef);
    if (!mySnap.exists()) return null;

    const myScore  = (mySnap.data() as LeaderboardEntry).score;
    const colRef   = collection(db, COLLECTION);
    // Compte combien de joueurs ont un score strictement supérieur
    const aboveQ   = query(colRef, where('score', '>', myScore));
    const aboveSnap = await getDocs(aboveQ);
    const rank      = aboveSnap.size + 1;

    const totalSnap = await getDocs(collection(db, COLLECTION));
    return { rank, total: totalSnap.size };
  } catch {
    return null;
  }
}
