// ============================================================
// VALEURS PAR DÉFAUT DU PROFIL JOUEUR — Progression v2 (C9)
//
// Source UNIQUE de l'état « profil neuf », utilisée pour :
//   - la création d'un profil (createPlayer) ;
//   - la remise à zéro unique des profils existants (progressionVersion < 2),
//     côté local (playerStore) ET côté Firestore (resetPlayerProgression).
//
// Fichier PUR (aucune dépendance React / Zustand / Firebase) : testé par
// __tests__/profileDefaults.test.ts.
// ============================================================

import { CURRENT_PROGRESSION_VERSION, INITIAL_SEEDS } from './progression';
import type { AdViews } from './adRewards';

/**
 * Valeurs d'un profil neuf. Fonction (et non constante) pour renvoyer à chaque
 * appel des objets et tableaux NEUFS : aucune mutation partagée possible.
 *
 * NE contient volontairement PAS : userId, username, usernameLower, email,
 * createdAt (identité du compte, conservée à la remise à zéro), ni les
 * préférences d'interface (langue, effet visuel, réglages audio).
 */
export function createDefaultProgressionFields() {
  return {
    progressionVersion: CURRENT_PROGRESSION_VERSION,

    // ── Économie ───────────────────────────────────────────
    seeds: INITIAL_SEEDS,
    /**
     * ATTENTION — `isPremium` est remis à false UNIQUEMENT parce que les testeurs
     * actuels n'ont pas payé (décision D14 de la Progression v2).
     * EN PRODUCTION, UN ACHAT NE DOIT JAMAIS ÊTRE REMIS À ZÉRO : avant toute
     * publication, il faudra conserver `isPremium` lors d'une remise à zéro
     * (et ne plus passer par ce chemin pour les comptes ayant acheté).
     */
    isPremium: false,
    friendChallengeTokens: 3,

    // ── Progression solo ───────────────────────────────────
    completedChallenges: [] as string[],
    challengeStars: {} as Record<string, 1 | 2 | 3>,
    levelsCompleted: 0,
    currentLevel: 1,
    lastPlayedChallengeId: null as string | null,
    challengeStartedAt: {} as Record<string, number>,

    // ── Cérémonies et nouveautés (Lots 3-4) ────────────────
    pendingCeremonies: [] as string[],
    seenCeremonies: [] as string[],
    /** Chapitres (1 à 7) dont la récompense de fin de chapitre a déjà été versée. Anti-doublon (Lot 3). */
    rewardedChapters: [] as number[],
    /** Chapitres dont la carte d'Herbier de fin de chapitre a déjà été offerte (anti-doublon, Lot 7). */
    chapterCardsGranted: [] as number[],
    newFeatureBadges: [] as string[],

    // ── Badges / trophées ──────────────────────────────────
    earnedBadges: [] as string[],
    badgeShowcase: [] as string[],
    unlockedMusicIds: [] as string[],

    // ── Compteurs de trophées (Lot 8) ──────────────────────
    starStreak: 0,
    quickFirstWins: 0,
    improvedStarChallengeIds: [] as string[],
    loyaltyStreak: 0,
    /** Meilleure série de jours joués d'affilée : record qui ne baisse jamais (Habitué, Lot 8). */
    loyaltyBest: 0,
    /** Meilleure série de victoires ⭐⭐+ d'affilée (Œil de lynx) : record qui ne baisse jamais. */
    bestStarStreak: 0,
    /** Podium du Journalier, inclusif, enregistré au moment de la partie (Lot 8). */
    dailyPodium: { top10Percent: 0, top3: 0, first: 0 },

    // ── Séries et dates ────────────────────────────────────
    dailyStreak: 0,
    lastPlayedDate: '',
    dailyChallengeStreak: 0,
    longestDailyChallengeStreak: 0,
    lastDailyChallengeDate: '',
    dailyChallengeStatus: null as null,
    dailyChallengeTimeMs: null as number | null,

    // ── Forestier / Herbier ────────────────────────────────
    onfSolvedCount: 0,
    completedOnfChallengeIds: [] as string[],
    hasSeenOnfBriefing: false,
    onfDailyCount: 0,
    lastOnfDailyDate: '',
    lastOnfCompoKey: null as string | null,
    collectedTreeCardIds: [] as number[],
    /** Cartes de l'Herbier déjà vues dans la collection : le badge rouge compte les autres (Lot 7). */
    seenTreeCardIds: [] as number[],

    // ── Duel / amis ────────────────────────────────────────
    challengedFriendIds: [] as string[],
    /** Défis entre amis terminés déjà comptés dans les statistiques (un défi ne se compte qu'une fois, Lot D). */
    countedDuelIds: [] as string[],
    /** Série de victoires de Duel en cours (le record est `stats.friendBestWinStreak`). */
    duelWinStreak: 0,

    // ── Bonus ──────────────────────────────────────────────
    dailyBonusUses: { reveal_cell: 3, instinct: 3 },
    lastBonusResetDate: null as string | null,
    challengeCountToday: 0,
    bonusTutorialDismissed: [] as string[],
    /** Pubs récompensées regardées aujourd'hui, par emplacement (Lot B). Remplace `watchAdUsedToday`. */
    adViews: {} as AdViews,

    // ── Métriques audio liées à la progression ─────────────
    trackPlayCounts: {} as Record<string, number>,
  };
}

/** Statistiques d'un profil neuf (même forme que `PlayerStats` du store). */
export function createDefaultStats() {
  return {
    totalSolved: 0,
    bestTimes: {} as Record<string, number>,
    currentStreak: 0,
    longestStreak: 0,
    noErrorStreak: 0,
    friendWins: 0,
    totalFriendsInvited: 0,
    topDEJCount: 0,
    sameChallengePlays: {} as Record<string, number>,
    failCount: {} as Record<string, number>,
    improvedChallengesCount: 0,
    seasonalChallengesPlayed: 0,
    abandonCount: {} as Record<string, number>,
    dailyPlayed: 0,
    dailyWon: 0,
    friendPlayed: 0,
    avgResolutionMs: 0,
    totalResolutionCount: 0,
    onfPerfectCount: 0,
    onfSpeedCount: 0,
    dailyPerfectCount: 0,
    dailySpeedCount: 0,
    // ── Lot D ──
    friendLosses: 0,
    friendBestWinStreak: 0,
    dailyPlayedPousse: 0,
    dailyWonPousse: 0,
    dailyPlayedGrandChene: 0,
    dailyWonGrandChene: 0,
    bestDailyTimeMsPousse: 0,
    bestDailyTimeMsGrandChene: 0,
    bestOnfTimeMs: 0,
    seedsEarned: 0,
    seedsSpent: 0,
    adsWatched: 0,
    daysPlayed: 0,
  };
}

/** Compteurs du Lot D, absents d'une sauvegarde ou d'un profil antérieurs : valeur neutre 0. */
export const LOT_D_STAT_KEYS = [
  'friendLosses', 'friendBestWinStreak',
  'dailyPlayedPousse', 'dailyWonPousse', 'dailyPlayedGrandChene', 'dailyWonGrandChene',
  'bestDailyTimeMsPousse', 'bestDailyTimeMsGrandChene', 'bestOnfTimeMs',
  'seedsEarned', 'seedsSpent', 'adsWatched', 'daysPlayed',
] as const;

/** Lit les compteurs du Lot D d'une source non fiable (sauvegarde locale, profil Firestore) : nombres positifs, sinon 0. */
export function readLotDStats(raw: unknown): Record<(typeof LOT_D_STAT_KEYS)[number], number> {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = {} as Record<(typeof LOT_D_STAT_KEYS)[number], number>;
  for (const k of LOT_D_STAT_KEYS) {
    const v = src[k];
    out[k] = typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }
  return out;
}

/**
 * Clés de PlayerProfile (Firestore) écrasées par la remise à zéro.
 * Sert aux tests et à la revue : tout champ de progression listé ici doit
 * être remis à sa valeur par défaut dans `buildFirestoreResetPayload`.
 */
export const RESET_FIRESTORE_FIELDS = [
  'progressionVersion', 'seeds', 'isPremium',
  'completedChallenges', 'challengeStars', 'levelsCompleted',
  'pendingCeremonies', 'seenCeremonies', 'rewardedChapters', 'chapterCardsGranted', 'newFeatureBadges', 'unlockedMusicIds',
  'starStreak', 'quickFirstWins', 'improvedStarChallengeIds', 'loyaltyStreak', 'loyaltyBest', 'bestStarStreak', 'dailyPodium',
  'earnedBadges', 'badgeShowcase', 'stats',
  'dailyStreak', 'lastPlayedDate',
  'dailyChallengeStreak', 'longestDailyChallengeStreak', 'lastDailyChallengeDate',
  'onfSolvedCount', 'completedOnfChallengeIds', 'collectedTreeCardIds', 'seenTreeCardIds',
  'challengedFriendIds', 'countedDuelIds', 'duelWinStreak',
] as const;

/**
 * Anciens champs d'objectifs de badges, SUPPRIMÉS du profil Firestore à la remise à zéro (Lot 8) : les trophées
 * n'ont plus d'objectif actif. `resetPlayerProgression` les supprime avec `deleteField()`.
 */
export const REMOVED_FIRESTORE_FIELDS = [
  'trackGoals', 'activeBadgeGoals', 'goalCounters', 'retryStreak', 'retryStreakFusee',
] as const;

/**
 * Charge utile Firestore de la remise à zéro (champs de progression uniquement).
 * Identité (userId, username, usernameLower, createdAt) et préférences
 * (langue, audio, sélection musicale) ne sont pas touchées : `merge: true` les conserve.
 *
 * Les anciens champs d'objectifs (`REMOVED_FIRESTORE_FIELDS`) ne sont pas dans cette charge utile : ils sont
 * supprimés par `deleteField()` dans `resetPlayerProgression`.
 */
export function buildFirestoreResetPayload() {
  const d = createDefaultProgressionFields();
  return {
    progressionVersion: d.progressionVersion,
    seeds: d.seeds,
    isPremium: d.isPremium,
    completedChallenges: d.completedChallenges,
    challengeStars: d.challengeStars,
    levelsCompleted: d.levelsCompleted,
    pendingCeremonies: d.pendingCeremonies,
    seenCeremonies: d.seenCeremonies,
    rewardedChapters: d.rewardedChapters,
    chapterCardsGranted: d.chapterCardsGranted,
    newFeatureBadges: d.newFeatureBadges,
    unlockedMusicIds: d.unlockedMusicIds,
    starStreak: d.starStreak,
    quickFirstWins: d.quickFirstWins,
    improvedStarChallengeIds: d.improvedStarChallengeIds,
    loyaltyStreak: d.loyaltyStreak,
    loyaltyBest: d.loyaltyBest,
    bestStarStreak: d.bestStarStreak,
    dailyPodium: d.dailyPodium,
    earnedBadges: d.earnedBadges,
    badgeShowcase: d.badgeShowcase,
    stats: createDefaultStats(),
    dailyStreak: d.dailyStreak,
    lastPlayedDate: d.lastPlayedDate,
    dailyChallengeStreak: d.dailyChallengeStreak,
    longestDailyChallengeStreak: d.longestDailyChallengeStreak,
    lastDailyChallengeDate: d.lastDailyChallengeDate,
    onfSolvedCount: d.onfSolvedCount,
    completedOnfChallengeIds: d.completedOnfChallengeIds,
    collectedTreeCardIds: d.collectedTreeCardIds,
    seenTreeCardIds: d.seenTreeCardIds,
    challengedFriendIds: d.challengedFriendIds,
    countedDuelIds: d.countedDuelIds,
    duelWinStreak: d.duelWinStreak,
  };
}
