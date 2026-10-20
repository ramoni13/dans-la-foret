// ============================================================
// METRICS SERVICE — Métriques de rétention & valorisation
// Collection principale : /metrics/{userId}
// Collection événements  : /events/{autoId}  (optionnel, léger)
//
// Métriques collectées pour :
//   - Rétention (DAU/WAU/MAU, streaks, retour après abandon)
//   - Engagement (sessions, temps de jeu, modes utilisés)
//   - Progression (niveaux, défis, badges, rang)
//   - Monétisation potentielle (premium, graines, achats futurs)
//   - Viralité (défis entre amis, invitations)
//   - Qualité (taux d'erreur, taux de complétion, abandon)
// ============================================================

import {
  doc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  collection,
  addDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ──────────────────────────────────────────────────────────────────────

export type GameMode = 'solo' | 'daily' | 'onf' | 'friend';

export interface SessionMetrics {
  userId: string;
  sessionStartedAt: any;       // serverTimestamp
  platform: string;            // 'ios' | 'android' | 'web'
  appVersion?: string;
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function getWeek(): string {
  const d = new Date();
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

// ── Référence document métriques joueur ───────────────────────────────────────

function metricsRef(userId: string) {
  return doc(db, 'metrics', userId);
}

// ── 1. Initialiser les métriques d'un nouveau joueur ─────────────────────────
// Appelé à la création du compte (upsert safe).
export async function initPlayerMetrics(
  userId: string,
  platform: string,
): Promise<void> {
  const today = getToday();
  await setDoc(metricsRef(userId), {
    userId,
    // ── Dates clés ──────────────────────────────────────────
    firstSeenAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    lastSeenDate: today,
    // ── Activité globale ────────────────────────────────────
    totalSessions: 1,
    totalPlaytimeMs: 0,
    // ── Rétention par fenêtre ───────────────────────────────
    dau: { [today]: 1 },                  // jours actifs
    wau: { [getWeek()]: 1 },              // semaines actives
    mau: { [getMonth()]: 1 },             // mois actifs
    activeDaysCount: 1,
    activeWeeksCount: 1,
    activeMonthsCount: 1,
    // ── Progression ─────────────────────────────────────────
    currentLevel: 1,
    maxLevelReached: 1,
    soloCompleted: 0,
    dailyCompleted: 0,
    onfCompleted: 0,
    friendCompleted: 0,
    totalChallengesCompleted: 0,
    // ── Engagement ──────────────────────────────────────────
    longestDailyStreak: 0,
    currentDailyStreak: 0,
    longestPlayStreak: 0,
    currentPlayStreak: 0,
    badgesEarned: 0,
    currentRank: 'Promeneur',
    // ── Qualité ─────────────────────────────────────────────
    totalErrors: 0,
    totalAbandonCount: 0,
    avgResolutionMs: 0,
    perfectRunsCount: 0,
    // ── Viralité ────────────────────────────────────────────
    friendChallengesSent: 0,
    friendChallengesWon: 0,
    friendsInvited: 0,
    // ── Monétisation ────────────────────────────────────────
    isPremium: false,
    totalSeedsEarned: 0,
    totalSeedsSpent: 0,
    currentSeeds: 0,
    // ── Modes utilisés (diversité d'engagement) ─────────────
    modesUsed: ['solo'],
    // ── Plateforme ──────────────────────────────────────────
    platform,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── 2. Enregistrer une session (ouverture de l'app) ───────────────────────────
// Appelé au changement d'état auth dans (tabs)/_layout.tsx.
export async function recordSession(
  userId: string,
  platform: string,
  isPremium: boolean,
  currentLevel: number,
  currentSeeds: number,
  badgesCount: number,
  currentRank: string,
  currentStreak: number,
  longestStreak: number,
): Promise<void> {
  const today   = getToday();
  const week    = getWeek();
  const month   = getMonth();

  // Mise à jour atomique — Firestore merge partiel
  await setDoc(metricsRef(userId), {
    lastSeenAt:   serverTimestamp(),
    lastSeenDate: today,
    platform,
    isPremium,
    currentLevel,
    currentSeeds,
    badgesEarned: badgesCount,
    currentRank,
    currentDailyStreak: currentStreak,
    longestDailyStreak: longestStreak,
    updatedAt: serverTimestamp(),
    // Incrémenter le compteur de sessions
    totalSessions:   increment(1),
    // Marquer activité DAU/WAU/MAU (valeur 1 = actif ce jour/semaine/mois)
    [`dau.${today}`]:   1,
    [`wau.${week}`]:    1,
    [`mau.${month}`]:   1,
  }, { merge: true });
}

// ── 3. Enregistrer une victoire ────────────────────────────────────────────────
// Appelé après chaque victoire (solo, daily, ONF, ami).
export async function recordVictory(
  userId: string,
  mode: GameMode,
  elapsedMs: number,
  failCount: number,
  seedsEarned: number,
  currentLevel: number,
  currentSeeds: number,
  badgesCount: number,
  currentRank: string,
): Promise<void> {
  const modeField: Record<GameMode, string> = {
    solo:   'soloCompleted',
    daily:  'dailyCompleted',
    onf:    'onfCompleted',
    friend: 'friendCompleted',
  };

  const updates: Record<string, any> = {
    [modeField[mode]]:         increment(1),
    totalChallengesCompleted:  increment(1),
    totalSeedsEarned:          increment(seedsEarned),
    totalErrors:               increment(failCount),
    currentLevel,
    currentSeeds,
    badgesEarned:              badgesCount,
    currentRank,
    updatedAt:                 serverTimestamp(),
    lastSeenAt:                serverTimestamp(),
  };

  // Temps de résolution moyen (mis à jour côté client, approximatif mais suffisant)
  if (elapsedMs > 0) {
    updates.lastResolutionMs = elapsedMs;
  }

  if (failCount === 0) {
    updates.perfectRunsCount = increment(1);
  }

  // Ajouter le mode au set modesUsed (arrayUnion = pas de doublon)
  updates.modesUsed = arrayUnion(mode);

  await setDoc(metricsRef(userId), updates, { merge: true });
}

// ── 4. Enregistrer un abandon ─────────────────────────────────────────────────
export async function recordAbandonment(
  userId: string,
  mode: GameMode,
): Promise<void> {
  await setDoc(metricsRef(userId), {
    totalAbandonCount: increment(1),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── 5. Mettre à jour les métriques de monétisation ───────────────────────────
export async function recordSeedsSpent(
  userId: string,
  amount: number,
  currentSeeds: number,
): Promise<void> {
  await setDoc(metricsRef(userId), {
    totalSeedsSpent: increment(amount),
    currentSeeds,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── 6. Mettre à jour progression badges & rang ────────────────────────────────
export async function recordBadgeProgress(
  userId: string,
  newBadgeIds: string[],
  totalBadgesCount: number,
  currentRank: string,
): Promise<void> {
  if (newBadgeIds.length === 0) return;
  await setDoc(metricsRef(userId), {
    badgesEarned:    totalBadgesCount,
    currentRank,
    updatedAt:       serverTimestamp(),
  }, { merge: true });
}

// ── 7. Mettre à jour les métriques de viralité ───────────────────────────────
export async function recordFriendChallengeSent(userId: string): Promise<void> {
  await setDoc(metricsRef(userId), {
    friendChallengesSent: increment(1),
    modesUsed: arrayUnion('friend'),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function recordFriendChallengeWon(userId: string): Promise<void> {
  await setDoc(metricsRef(userId), {
    friendChallengesWon: increment(1),
    friendCompleted:     increment(1),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── 8. Snapshot complet du profil (mise à jour périodique) ────────────────────
// Permet de reconstituer une cohorte même sans requêtes d'agrégation.
export async function snapshotPlayerProfile(
  userId: string,
  profile: {
    isPremium: boolean;
    currentLevel: number;
    currentSeeds: number;
    badgesCount: number;
    currentRank: string;
    totalSolved: number;
    currentStreak: number;
    longestStreak: number;
    dailyPlayed: number;
    dailyWon: number;
    friendWins: number;
    onfSolvedCount: number;
  },
): Promise<void> {
  await setDoc(metricsRef(userId), {
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
