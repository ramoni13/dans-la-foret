// ============================================================
// ADMIN SERVICE — Outils d'administration de la base joueurs
// Réservé à l'usage interne (Ramoni uniquement).
// ============================================================

import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from './firebase';

export interface AdminPlayerSummary {
  userId: string;
  username: string;
  seeds: number;
  completedCount: number;
  earnedBadgesCount: number;
  createdAt?: any;
}

// ── Récupérer tous les joueurs (résumé) ───────────────────────────────────────
export async function getAllPlayers(): Promise<AdminPlayerSummary[]> {
  const q = query(collection(db, 'players'), orderBy('username'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      userId: data.userId ?? d.id,
      username: data.username ?? 'Joueur',
      seeds: data.seeds ?? 0,
      completedCount: (data.completedChallenges ?? []).length,
      earnedBadgesCount: (data.earnedBadges ?? []).length,
      createdAt: data.createdAt ?? null,
    };
  });
}

// ── Réinitialiser un joueur (tout sauf username / email / mot de passe) ────────
// Conserve : userId, username, usernameLower, email, createdAt
// Remet à zéro : toutes les statistiques, badges, progression, graines
export async function resetPlayer(userId: string, username: string): Promise<void> {
  const ref = doc(db, 'players', userId);

  const resetData = {
    userId,
    username,
    usernameLower: username.trim().toLowerCase(),
    seeds: 0,
    completedChallenges: [],
    stats: {
      totalSolved: 0,
      currentStreak: 0,
      longestStreak: 0,
      bestTimes: {},
      noErrorStreak: 0,
      friendWins: 0,
      totalFriendsInvited: 0,
      topDEJCount: 0,
      sameChallengePlays: {},
      failCount: {},
      improvedChallengesCount: 0,
      seasonalChallengesPlayed: 0,
      dailyPlayed: 0,
      dailyWon: 0,
      friendPlayed: 0,
      avgResolutionMs: 0,
      totalResolutionCount: 0,
      speedBadgeHits: {},
      abandonCount: {},
    },
    isPremium: false,
    earnedBadges: [],
    badgeShowcase: [],
    unlockedBonuses: [],
    unlockedThemes: [],
    unlockedOnf: false,
    dailyStreak: 0,
    lastPlayedDate: '',
    onfSolvedCount: 0,
    completedOnfChallengeIds: [],
    activeBadgeGoals: [],
    goalCounters: {},
    dailyChallengeStatus: 'none',
    lastDailyChallengeDate: '',
    dailyChallengeStreak: 0,
    longestDailyChallengeStreak: 0,
    friendNotifBadgeEnabled: true,
    autoGoal: true,
    language: 'fr',
    updatedAt: serverTimestamp(),
    // createdAt est volontairement absent → setDoc merge le conservera
  };

  // merge: false → remplace tout le document (sauf les champs absents comme createdAt
  // que l'on ne veut pas écraser). On utilise setDoc sans merge pour repartir proprement,
  // puis on relira createdAt depuis le document existant au besoin.
  // Ici on choisit merge:true pour conserver createdAt et email s'il existe.
  await setDoc(ref, resetData, { merge: true });
}

// ── Supprimer complètement un joueur de Firestore ─────────────────────────────
// Ne supprime PAS le compte Firebase Auth (pas d'accès Admin SDK côté client).
// Le document Firestore est effacé ; l'utilisateur verra un profil vierge
// à la prochaine connexion (recréé par le flux normal de l'app).
export async function deletePlayer(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'players', userId));
}
