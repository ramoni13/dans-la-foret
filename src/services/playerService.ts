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
    // ── Nouveaux champs badges ──────────────────────────
    noErrorStreak: number;
    friendWins: number;
    totalFriendsInvited: number;
    topDEJCount: number;
    sameChallengePlays: Record<string, number>;
    failCount: Record<string, number>;
    improvedChallengesCount: number;
    seasonalChallengesPlayed: number;
  };
  isPremium: boolean;
  createdAt?: any;
  updatedAt?: any;
  // ── Champs badges ────────────────────────────────────
  earnedBadges: string[];
  badgeShowcase: string[];   // max 3 IDs
  unlockedBonuses: string[];
  unlockedThemes: string[];
  // ── Streak quotidien ─────────────────────────────────
  dailyStreak: number;
  lastPlayedDate: string;    // "YYYY-MM-DD"
}

// ── Calcul du niveau courant d'un joueur ──────────────────────────────────────
// Basé sur le nombre de défis solo complétés : 1 niveau par tranche de 3 défis.
// Niveau 1 minimum, niveau 15 maximum.
export function computePlayerLevel(completedCount: number): number {
  return Math.min(15, Math.max(1, Math.ceil(completedCount / 3)));
}

// ── Résultat de recherche d'ami ───────────────────────────────────────────────
export interface PlayerSearchResult {
  userId: string;
  username: string;
  level: number;
}

// ── Migration silencieuse : garantit que tous les champs existent ─────────────
function migrateProfile(raw: any): PlayerProfile {
  return {
    userId:             raw.userId ?? '',
    username:           raw.username ?? 'Joueur',
    seeds:              raw.seeds ?? 3,
    completedChallenges: raw.completedChallenges ?? [],
    isPremium:          raw.isPremium ?? false,
    createdAt:          raw.createdAt,
    updatedAt:          raw.updatedAt,
    stats: {
      totalSolved:            raw.stats?.totalSolved ?? 0,
      currentStreak:          raw.stats?.currentStreak ?? 0,
      longestStreak:          raw.stats?.longestStreak ?? 0,
      bestTimes:              raw.stats?.bestTimes ?? {},
      noErrorStreak:          raw.stats?.noErrorStreak ?? 0,
      friendWins:             raw.stats?.friendWins ?? 0,
      totalFriendsInvited:    raw.stats?.totalFriendsInvited ?? 0,
      topDEJCount:            raw.stats?.topDEJCount ?? 0,
      sameChallengePlays:       raw.stats?.sameChallengePlays ?? {},
      failCount:                raw.stats?.failCount ?? {},
      improvedChallengesCount:  raw.stats?.improvedChallengesCount ?? 0,
      seasonalChallengesPlayed: raw.stats?.seasonalChallengesPlayed ?? 0,
    },
    earnedBadges:    raw.earnedBadges ?? [],
    badgeShowcase:   raw.badgeShowcase ?? [],
    unlockedBonuses: raw.unlockedBonuses ?? [],
    unlockedThemes:  raw.unlockedThemes ?? [],
    dailyStreak:     raw.dailyStreak ?? 0,
    lastPlayedDate:  raw.lastPlayedDate ?? '',
  };
}

// ── Créer ou mettre à jour le profil ─────────────────────────────────────────
export async function upsertPlayer(profile: PlayerProfile): Promise<void> {
  const ref = doc(db, 'players', profile.userId);
  await setDoc(ref, {
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Récupérer un profil (avec migration) ──────────────────────────────────────
export async function getPlayer(userId: string): Promise<PlayerProfile | null> {
  const ref  = doc(db, 'players', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return migrateProfile(snap.data());
}

// ── Vérifier si un pseudo est déjà pris (insensible à la casse) ──────────────
// Utilise le champ `usernameLower` stocké en minuscules à la création.
export async function isUsernameTaken(username: string): Promise<boolean> {
  const lower = username.trim().toLowerCase();
  if (!lower) return false;
  const q = query(
    collection(db, 'players'),
    where('usernameLower', '==', lower),
    limit(1),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ── Créer un nouveau profil (premier lancement) ───────────────────────────────
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
      noErrorStreak: 0,
      friendWins: 0,
      totalFriendsInvited: 0,
      topDEJCount: 0,
      sameChallengePlays: {},
      failCount: {},
      improvedChallengesCount: 0,
      seasonalChallengesPlayed: 0,
    },
    isPremium: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    earnedBadges: [],
    badgeShowcase: [],
    unlockedBonuses: [],
    unlockedThemes: [],
    dailyStreak: 0,
    lastPlayedDate: '',
  };
  // usernameLower permet la recherche d'unicité insensible à la casse
  await setDoc(doc(db, 'players', userId), {
    ...profile,
    usernameLower: username.trim().toLowerCase(),
  });
  return profile;
}

// ── Mettre à jour les graines ─────────────────────────────────────────────────
export async function updateSeeds(userId: string, seeds: number): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    seeds,
    updatedAt: serverTimestamp(),
  });
}

// ── Chercher des joueurs par pseudo (insensible à la casse) ──────────────────
// Double requête pour couvrir :
//   - les nouveaux comptes qui ont le champ `usernameLower`
//   - les anciens comptes créés avant l'ajout de ce champ (recherche sur `username`)
export async function searchPlayers(
  searchTerm: string,
  excludeUid: string,
  maxResults = 8,
): Promise<PlayerSearchResult[]> {
  if (!searchTerm.trim() || searchTerm.length < 2) return [];

  const termLower = searchTerm.trim().toLowerCase();
  const termUpper = searchTerm.trim();

  // Borne haute pour la requête préfixe Firestore (>= term, < termEnd)
  const makeTermEnd = (t: string) =>
    t.slice(0, -1) + String.fromCharCode(t.charCodeAt(t.length - 1) + 1);

  const termLowerEnd = makeTermEnd(termLower);
  const termUpperEnd = makeTermEnd(termUpper);

  // Requête 1 : champ usernameLower (nouveaux comptes, insensible à la casse)
  const qLower = query(
    collection(db, 'players'),
    where('usernameLower', '>=', termLower),
    where('usernameLower', '<', termLowerEnd),
    limit(maxResults),
  );

  // Requête 2 : champ username original (anciens comptes sans usernameLower)
  // On cherche avec la casse exacte du terme saisi — Firestore ne supporte pas
  // l'insensible à la casse natif, mais au moins on rattrape les anciens profils.
  const qOriginal = query(
    collection(db, 'players'),
    where('username', '>=', termUpper),
    where('username', '<', termUpperEnd),
    limit(maxResults),
  );

  const [snapLower, snapOriginal] = await Promise.all([
    getDocs(qLower),
    getDocs(qOriginal),
  ]);

  // Fusionner en dédupliquant par userId
  const seen = new Set<string>();
  const results: PlayerSearchResult[] = [];

  for (const snap of [snapLower, snapOriginal]) {
    for (const d of snap.docs) {
      const profile = migrateProfile(d.data());
      if (profile.userId === excludeUid) continue;
      if (seen.has(profile.userId)) continue;
      seen.add(profile.userId);

      // Rétro-alimenter usernameLower si absent (migration silencieuse)
      if (!d.data().usernameLower) {
        updateDoc(d.ref, { usernameLower: profile.username.toLowerCase() }).catch(() => {});
      }

      results.push({
        userId: profile.userId,
        username: profile.username,
        level: computePlayerLevel(profile.completedChallenges?.length ?? 0),
      });

      if (results.length >= maxResults) break;
    }
    if (results.length >= maxResults) break;
  }

  return results;
}

// ── Marquer un défi comme complété ────────────────────────────────────────────
export async function markCompleted(
  userId: string,
  challengeId: string,
  timeMs: number,
  currentProfile: PlayerProfile
): Promise<void> {
  const alreadyDone = currentProfile.completedChallenges.includes(challengeId);
  const prevBest    = currentProfile.stats.bestTimes[challengeId];
  const newBest     = prevBest !== undefined ? Math.min(prevBest, timeMs) : timeMs;

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
