// ============================================================
// STATISTIQUES DU JOUEUR — agrégats d'affichage et fusion local/cloud : logique pure (Lot D)
//
// Aucune dépendance React / Zustand / Firebase : testé dans __tests__/playerStats.test.ts.
//
// Deux rôles :
//   1. `buildStatsView` : transforme l'état du joueur en 4 blocs affichés (Progression, Solo, Modes, Régularité).
//   2. `mergeStats` : fusion des statistiques locales et cloud. Règle : les compteurs cumulatifs ne baissent JAMAIS
//      (max local / cloud) ; les records de temps gardent le meilleur ; les dictionnaires fusionnent clé par clé.
//
// Avant le Lot D, `restoreFromCloud` ÉCRASAIT `dailyPlayed`, `dailyWon`, `friendPlayed`, `failCount`… par la valeur cloud
// (0 si le Journalier ou le Duel n'avaient jamais écrit leurs stats dans Firestore). `dailyWon` alimente le trophée
// Rendez-vous : un joueur pouvait donc perdre sa progression de trophée en se reconnectant.
// ============================================================

import { CHAPTERS, countThreeStarChallenges, countTotalStars, getChapterForLevel, getLevelFromChallengeId } from './progression';
import type { DailyLeague } from './dailyLeagues';
import type { OnfTier } from './onfTiers';

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

// ── Série du Journalier ──────────────────────────────────────────────────────

/** Jours entre deux dates `YYYY-MM-DD` (UTC) ; `null` si l'une est invalide. */
export function daysBetween(a: string, b: string): number | null {
  const x = Date.parse(`${a}T00:00:00Z`);
  const y = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Math.round((y - x) / 86_400_000);
}

/**
 * Série du Journalier à AFFICHER. La série stockée ne retombe à 0 qu'à un échec explicite : un jour simplement non
 * joué la laisse intacte jusqu'à la victoire suivante. Pour l'affichage, une série n'est « en cours » que si le
 * dernier jour joué est aujourd'hui ou hier (UTC, comme les grilles) ; sinon elle est rompue : 0.
 */
export function effectiveDailyStreak(streak: number, lastDailyDate: string, todayUtc: string): number {
  if (!(streak > 0) || !lastDailyDate) return 0;
  const gap = daysBetween(lastDailyDate, todayUtc);
  if (gap === null) return 0;
  return gap <= 1 && gap >= 0 ? streak : 0;
}

// ── Forestier par palier (dérivé, jamais stocké) ─────────────────────────────

/**
 * Grilles du Forestier résolues et existantes, par palier. Déduit de `completedOnfChallengeIds` et du champ `tier` de
 * chaque grille : aucun compteur n'est stocké, donc rien à fusionner ni à faire dériver. Une grille terminée dont
 * l'identifiant n'existe plus (renumérotation des grilles) n'est comptée dans aucun palier.
 */
export function countOnfByTier(
  completedIds: readonly string[] | null | undefined,
  grids: ReadonlyArray<{ id: string; tier: OnfTier }>,
): { solved: Partial<Record<OnfTier, number>>; totals: Partial<Record<OnfTier, number>> } {
  const done = new Set(completedIds ?? []);
  const solved: Partial<Record<OnfTier, number>> = {};
  const totals: Partial<Record<OnfTier, number>> = {};
  for (const g of grids) {
    totals[g.tier] = (totals[g.tier] ?? 0) + 1;
    if (done.has(g.id)) solved[g.tier] = (solved[g.tier] ?? 0) + 1;
  }
  return { solved, totals };
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

// ── Pourcentages ─────────────────────────────────────────────────────────────

/** Pourcentage entier (0-100), `null` si le dénominateur est nul. Jamais plus de 100 : un compteur incohérent est borné. */
export function percent(part: number, total: number): number | null {
  if (!(total > 0)) return null;
  return Math.min(100, Math.max(0, Math.round((Math.min(part, total) / total) * 100)));
}

// ── Temps moyen du Solo ──────────────────────────────────────────────────────

/**
 * Meilleurs temps regroupés par chapitre. Le temps moyen « tous niveaux » croissait mécaniquement avec la progression
 * (les niveaux avancés sont plus longs) : il ne mesurait pas la vitesse du joueur. Par chapitre, on compare ce qui est
 * comparable.
 */
export function averageBestTimeByChapter(
  bestTimes: Record<string, number> | null | undefined,
): Array<{ chapterId: number; count: number; averageMs: number }> {
  const sums = new Map<number, { total: number; count: number }>();
  for (const [challengeId, ms] of Object.entries(bestTimes ?? {})) {
    const t = num(ms);
    if (t <= 0) continue;
    const level = getLevelFromChallengeId(challengeId);
    if (level === null) continue;
    const chapter = getChapterForLevel(level);
    if (!chapter) continue;
    const cur = sums.get(chapter.id) ?? { total: 0, count: 0 };
    cur.total += t;
    cur.count += 1;
    sums.set(chapter.id, cur);
  }
  return CHAPTERS
    .map(ch => ({ chapterId: ch.id, entry: sums.get(ch.id) }))
    .filter((x): x is { chapterId: number; entry: { total: number; count: number } } => !!x.entry)
    .map(x => ({ chapterId: x.chapterId, count: x.entry.count, averageMs: Math.round(x.entry.total / x.entry.count) }));
}

// ── Vue d'affichage ──────────────────────────────────────────────────────────

export interface StatsViewInput {
  stats: StatsLike & { totalSolved?: number; dailyWon?: number };
  challengeStars: Record<string, number> | null | undefined;
  levelsCompleted: number;
  currentLevel: number;
  earnedTrophies: number;
  trophyTotal: number;
  herbierCount: number;
  herbierTotal: number;
  onfSolvedCount: number;
  /** Grilles du Forestier résolues / existantes par palier (déduites de completedOnfChallengeIds, jamais stockées). */
  onfSolvedByTier: Partial<Record<OnfTier, number>>;
  onfTierTotals: Partial<Record<OnfTier, number>>;
  dailyChallengeStreak: number;
  longestDailyChallengeStreak: number;
  lastDailyChallengeDate: string;
  loyaltyStreak: number;
  loyaltyBest: number;
  /** Date du jour `YYYY-MM-DD` (UTC). */
  todayUtc: string;
  starTotal: number;
}

export interface StatsView {
  progression: {
    stars: number;
    starTotal: number;
    threeStars: number;
    chapter: number;
    levelsCompleted: number;
    trophies: number;
    trophyTotal: number;
    herbier: number;
    herbierTotal: number;
  };
  solo: {
    solved: number;
    firstTryRate: number | null;
    byChapter: Array<{ chapterId: number; count: number; averageMs: number }>;
    fastestMs: number | null;
    abandons: number;
  };
  modes: {
    daily: { played: number; won: number; rate: number | null; byLeague: Record<DailyLeague, { played: number; won: number; bestMs: number | null }> };
    onf: { solved: number; byTier: Array<{ tier: OnfTier; solved: number; total: number }>; bestMs: number | null; perfect: number };
    duel: { played: number; wins: number; losses: number; rate: number | null; bestWinStreak: number };
  };
  regularity: {
    dailyStreak: number;
    dailyStreakRecord: number;
    loyaltyStreak: number;
    loyaltyBest: number;
    daysPlayed: number;
    seedsEarned: number;
    seedsSpent: number;
    adsWatched: number;
    totalWins: number;
  };
}

/**
 * Les 4 blocs du menu Statistiques. Toute valeur absente ou incohérente est ramenée à une valeur neutre : l'écran
 * n'a jamais à gérer `undefined` ni `NaN`.
 */
export function buildStatsView(i: StatsViewInput): StatsView {
  const s = i.stats;
  const sum = (o?: Record<string, number>) => Object.values(o ?? {}).reduce((a, b) => a + num(b), 0);

  const dailyPlayed = num(s.dailyPlayed);
  // Un compteur incohérent (gagnées > jouées) est borné : le pourcentage ne dépasse jamais 100 %
  const dailyWon = dailyPlayed > 0 ? Math.min(num(s.dailyWon), dailyPlayed) : num(s.dailyWon);
  const duelWins = num(s.friendWins);
  const duelLosses = num(s.friendLosses);
  const duelPlayed = duelWins + duelLosses;

  const solved = Math.max(num(s.totalSolved), Object.keys(i.challengeStars ?? {}).length);
  // Défis gagnés du premier coup : plus de ⭐⭐ ou ⭐⭐⭐ = pas d'échec de validation ; approximation par les étoiles
  const wellPlayed = Object.values(i.challengeStars ?? {}).filter(v => v >= 2).length;

  const byTier = (['sentier', 'clairiere', 'profonde'] as const).map(tier => ({
    tier,
    solved: Math.min(num(i.onfSolvedByTier[tier]), i.onfTierTotals[tier] ?? Infinity),
    total: i.onfTierTotals[tier] ?? 0,
  }));

  const allBest = Object.values(s.bestTimes ?? {}).map(num).filter(v => v > 0);

  return {
    progression: {
      stars: countTotalStars(i.challengeStars),
      starTotal: i.starTotal,
      threeStars: countThreeStarChallenges(i.challengeStars),
      chapter: getChapterForLevel(Math.min(21, i.currentLevel))?.id ?? 1,
      levelsCompleted: i.levelsCompleted,
      trophies: i.earnedTrophies,
      trophyTotal: i.trophyTotal,
      herbier: i.herbierCount,
      herbierTotal: i.herbierTotal,
    },
    solo: {
      solved,
      firstTryRate: percent(wellPlayed, solved),
      byChapter: averageBestTimeByChapter(s.bestTimes),
      fastestMs: allBest.length ? Math.min(...allBest) : null,
      abandons: sum(s.abandonCount),
    },
    modes: {
      daily: {
        played: dailyPlayed,
        won: dailyWon,
        rate: percent(dailyWon, dailyPlayed),
        byLeague: {
          pousse: {
            played: num(s.dailyPlayedPousse),
            won: num(s.dailyWonPousse),
            bestMs: num(s.bestDailyTimeMsPousse) || null,
          },
          grand_chene: {
            played: num(s.dailyPlayedGrandChene),
            won: num(s.dailyWonGrandChene),
            bestMs: num(s.bestDailyTimeMsGrandChene) || null,
          },
        },
      },
      onf: {
        solved: i.onfSolvedCount,
        byTier,
        bestMs: num(s.bestOnfTimeMs) || null,
        perfect: num(s.onfPerfectCount),
      },
      duel: {
        played: duelPlayed,
        wins: duelWins,
        losses: duelLosses,
        rate: percent(duelWins, duelPlayed),
        bestWinStreak: num(s.friendBestWinStreak),
      },
    },
    regularity: {
      dailyStreak: effectiveDailyStreak(i.dailyChallengeStreak, i.lastDailyChallengeDate, i.todayUtc),
      dailyStreakRecord: i.longestDailyChallengeStreak,
      loyaltyStreak: i.loyaltyStreak,
      loyaltyBest: i.loyaltyBest,
      daysPlayed: num(s.daysPlayed),
      seedsEarned: num(s.seedsEarned),
      seedsSpent: num(s.seedsSpent),
      adsWatched: num(s.adsWatched),
      totalWins: solved + dailyWon + duelWins + i.onfSolvedCount,
    },
  };
}
