// ============================================================
// STATISTIQUES DU JOUEUR — agrégats d'affichage et fusion local/cloud : logique pure (Lot D)
//
// Aucune dépendance React / Zustand / Firebase : testé dans __tests__/playerStats.test.ts.
//
// Deux rôles :
//   1. `buildStatsView` : transforme l'état du joueur en 3 blocs affichés (Solo, Autres modes, Régularité).
//   2. `mergeStats` : fusion des statistiques locales et cloud. Règle : les compteurs cumulatifs ne baissent JAMAIS
//      (max local / cloud) ; les records de temps gardent le meilleur ; les dictionnaires fusionnent clé par clé.
//
// Avant le Lot D, `restoreFromCloud` ÉCRASAIT `dailyPlayed`, `dailyWon`, `friendPlayed`, `failCount`… par la valeur cloud
// (0 si le Journalier ou le Duel n'avaient jamais écrit leurs stats dans Firestore). `dailyWon` alimente le trophée
// Rendez-vous : un joueur pouvait donc perdre sa progression de trophée en se reconnectant.
// ============================================================

import { countThreeStarChallenges } from './progression';

// ── Compteurs cumulatifs (jamais décrémentés) ────────────────────────────────

/** Compteurs numériques fusionnés par maximum. */
export const MAX_MERGED_COUNTERS = [
  'totalSolved',
  'currentStreak',
  'longestStreak',
  'noErrorStreak',
  'friendWins',
  'totalFriendsInvited',
  'topDEJCount',
  'improvedChallengesCount',
  'seasonalChallengesPlayed',
  'dailyPlayed',
  'dailyWon',
  'friendPlayed',
  'totalResolutionCount',
  'onfPerfectCount',
  'onfSpeedCount',
  'dailyPerfectCount',
  'dailySpeedCount',
  // Lot D
  'friendLosses',
  'friendBestWinStreak',
  'dailyPlayedPousse',
  'dailyWonPousse',
  'dailyPlayedGrandChene',
  'dailyWonGrandChene',
  'seedsEarned',
  'seedsSpent',
  'adsWatched',
  'daysPlayed',
] as const;

/** Dictionnaires `défi → nombre` fusionnés clé par clé (maximum). */
export const MAX_MERGED_RECORDS = ['sameChallengePlays', 'failCount', 'abandonCount'] as const;

export type CounterKey = (typeof MAX_MERGED_COUNTERS)[number];

/** Forme minimale des statistiques lues par ce module (le `PlayerStats` du store en est un sur-ensemble). */
export type StatsLike = Partial<Record<CounterKey, number>> & {
  bestTimes?: Record<string, number>;
  sameChallengePlays?: Record<string, number>;
  failCount?: Record<string, number>;
  abandonCount?: Record<string, number>;
  avgResolutionMs?: number;
  /** Victoires du Journalier au meilleur temps (meilleur temps par ligue, en ms). */
  bestDailyTimeMsPousse?: number;
  bestDailyTimeMsGrandChene?: number;
  /** Meilleur temps (ms) d'une grille du Forestier. */
  bestOnfTimeMs?: number;
};

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

function mergeRecordMax(a?: Record<string, number>, b?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const src of [a, b]) {
    if (!src || typeof src !== 'object') continue;
    for (const [k, v] of Object.entries(src)) out[k] = Math.max(out[k] ?? 0, num(v));
  }
  return out;
}

/** Meilleur temps = le plus petit temps POSITIF (0 / absent = pas de temps). */
function bestOf(a?: number, b?: number): number {
  const x = num(a);
  const y = num(b);
  if (x > 0 && y > 0) return Math.min(x, y);
  return x > 0 ? x : y;
}

function mergeBestTimes(a?: Record<string, number>, b?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const src of [a, b]) {
    if (!src || typeof src !== 'object') continue;
    for (const [k, v] of Object.entries(src)) {
      const t = num(v);
      if (t <= 0) continue;
      out[k] = out[k] ? Math.min(out[k], t) : t;
    }
  }
  return out;
}

/**
 * Fusion des statistiques locales et cloud. Retourne UN NOUVEL objet ; les entrées ne sont jamais modifiées.
 * - compteurs cumulatifs : maximum ;
 * - dictionnaires par défi : maximum par clé ; `bestTimes` : le plus petit temps par clé ;
 * - moyenne de résolution : celle de la source qui a le plus de parties comptées (la moyenne n'est pas additive) ;
 * - records de temps : le plus petit temps positif.
 */
export function mergeStats<T extends StatsLike>(local: T, cloud: StatsLike | null | undefined): T {
  const c = cloud ?? {};
  const out: Record<string, unknown> = { ...local };
  for (const k of MAX_MERGED_COUNTERS) out[k] = Math.max(num(local[k]), num(c[k]));
  for (const k of MAX_MERGED_RECORDS) out[k] = mergeRecordMax(local[k], c[k]);
  out.bestTimes = mergeBestTimes(local.bestTimes, c.bestTimes);
  const localWins = num(local.totalResolutionCount) >= num(c.totalResolutionCount);
  out.avgResolutionMs = localWins ? num(local.avgResolutionMs) || num(c.avgResolutionMs) : num(c.avgResolutionMs) || num(local.avgResolutionMs);
  out.bestDailyTimeMsPousse = bestOf(local.bestDailyTimeMsPousse, c.bestDailyTimeMsPousse);
  out.bestDailyTimeMsGrandChene = bestOf(local.bestDailyTimeMsGrandChene, c.bestDailyTimeMsGrandChene);
  out.bestOnfTimeMs = bestOf(local.bestOnfTimeMs, c.bestOnfTimeMs);
  return out as T;
}

// ── Duel : résultats réconciliés avec Firestore ──────────────────────────────

/** Un défi entre amis terminé (extrait de `friendChallenges`). */
export interface CompletedDuel {
  id: string;
  challengerUid: string;
  opponentUid: string;
  winnerId?: string;
}

export interface DuelTally {
  /** Identifiants de défis déjà comptés (à persister : un défi ne se compte qu'une fois). */
  countedIds: string[];
  played: number;
  wins: number;
  losses: number;
  /** Série de victoires en cours à la fin de la liste (ordre du plus ancien au plus récent). */
  winStreak: number;
  bestWinStreak: number;
}

/**
 * Compte les défis terminés pas encore comptés. Le résultat d'un duel n'est connu que lorsque l'adversaire a joué :
 * jusque-là le défi est « en attente » et ne compte NI en victoire NI en partie jouée. Avant le Lot D, le challenger était
 * compté gagnant dès l'envoi, avant tout résultat (pourcentage faux, et trophée Duel gonflé).
 *
 * - `duels` : défis terminés du joueur, du PLUS ANCIEN au plus récent (pour la série de victoires) ;
 * - `alreadyCounted` : identifiants déjà comptés ; ils sont ignorés ;
 * - `current` : état actuel du joueur (la série en cours repart de là).
 * Un défi dont le vainqueur est absent ou étranger au joueur est ignoré (jamais compté à tort).
 */
export function tallyNewDuels(
  uid: string,
  duels: readonly CompletedDuel[],
  alreadyCounted: readonly string[],
  current: { winStreak: number; bestWinStreak: number },
): DuelTally {
  const seen = new Set(alreadyCounted);
  const countedIds = [...alreadyCounted];
  let wins = 0;
  let losses = 0;
  let winStreak = Math.max(0, current.winStreak);
  let best = Math.max(0, current.bestWinStreak);
  for (const d of duels) {
    if (!d.id || seen.has(d.id)) continue;
    if (d.challengerUid !== uid && d.opponentUid !== uid) continue;
    if (!d.winnerId || (d.winnerId !== d.challengerUid && d.winnerId !== d.opponentUid)) continue;
    seen.add(d.id);
    countedIds.push(d.id);
    if (d.winnerId === uid) {
      wins += 1;
      winStreak += 1;
      best = Math.max(best, winStreak);
    } else {
      losses += 1;
      winStreak = 0;
    }
  }
  return { countedIds, played: wins + losses, wins, losses, winStreak, bestWinStreak: best };
}

// ── Vue d'affichage ──────────────────────────────────────────────────────────

export interface StatsViewInput {
  stats: StatsLike & { totalSolved?: number; dailyWon?: number };
  challengeStars: Record<string, number> | null | undefined;
  onfSolvedCount: number;
  longestDailyChallengeStreak: number;
  loyaltyBest: number;
}

/**
 * Statistiques affichées : uniquement celles qui se comprennent sans explication et qui ne se retrouvent pas ailleurs
 * dans l'app (graines, pommes de pin totales, chapitre, trophées, Herbier et série en cours sont déjà sur l'accueil
 * ou le profil). Toute valeur absente ou incohérente est ramenée à une valeur neutre : l'écran n'a jamais à gérer
 * `undefined` ni `NaN`.
 */
export interface StatsView {
  solo: {
    solved: number;
    perfect: number;
    fastestMs: number | null;
  };
  modes: {
    dailyWon: number;
    dailyPlayed: number;
    dailyStreakRecord: number;
    onfSolved: number;
    duelWins: number;
    duelPlayed: number;
  };
  regularity: {
    daysPlayed: number;
    loyaltyBest: number;
  };
}

export function buildStatsView(i: StatsViewInput): StatsView {
  const s = i.stats;

  const dailyPlayed = num(s.dailyPlayed);
  // Un compteur incohérent (gagnées > jouées) est borné : on n'affiche jamais « 5 / 3 »
  const dailyWon = dailyPlayed > 0 ? Math.min(num(s.dailyWon), dailyPlayed) : num(s.dailyWon);
  const duelWins = num(s.friendWins);
  const duelPlayed = duelWins + num(s.friendLosses);

  const solved = Math.max(num(s.totalSolved), Object.keys(i.challengeStars ?? {}).length);
  const allBest = Object.values(s.bestTimes ?? {}).map(num).filter(v => v > 0);

  return {
    solo: {
      solved,
      perfect: countThreeStarChallenges(i.challengeStars),
      fastestMs: allBest.length ? Math.min(...allBest) : null,
    },
    modes: {
      dailyWon: Math.max(dailyWon, 0),
      dailyPlayed: Math.max(dailyPlayed, dailyWon),
      dailyStreakRecord: Math.max(0, i.longestDailyChallengeStreak),
      onfSolved: Math.max(0, i.onfSolvedCount),
      duelWins,
      duelPlayed,
    },
    regularity: {
      daysPlayed: num(s.daysPlayed),
      loyaltyBest: Math.max(0, i.loyaltyBest),
    },
  };
}