// ============================================================
// CLASSEMENTS — score empaqueté, départage, entrées publiées : logique pure (Lot C)
//
// Aucune dépendance React / Zustand / Firebase : testé dans __tests__/leaderboardRank.test.ts.
//
// PRINCIPE. Chaque classement Firestore se lit avec UNE requête `orderBy(champ, 'desc').limit(N)` : pas d'index composite,
// pas de re-tri côté client. Le départage est donc « empaqueté » dans un seul nombre (`*Rank`) :
//
//   Étoiles   : étoiles → nombre de ⭐⭐⭐ → nombre de trophées → LE PREMIER ARRIVÉ à ce total
//   Journalier: victoires du jour (dans la ligue) → LE PREMIER ARRIVÉ à ce nombre de victoires
//   Records   : records détenus → celui dont le dernier record est le plus ancien (calculé côté client, voir plus bas)
//
// « Le premier arrivé » = l'instant (en minutes) où le joueur a atteint son résultat actuel. Il ne change que si le
// résultat change : republier la même position ne fait donc jamais perdre sa place (`resolveReachedAt`).
// Un nombre JavaScript est exact jusqu'à 2^53 (≈ 9,0e15) : le plus grand score étoiles possible vaut ≈ 6,3e14.
// ============================================================

import { countThreeStarChallenges, countTotalStars, getRankForLevel } from './progression';
import type { DailyLeague } from './dailyLeagues';

// ── Constantes ───────────────────────────────────────────────────────────────

/** Joueurs affichés par classement. */
export const LEADERBOARD_TOP = 100;

/** Total d'étoiles possible : 21 niveaux × 10 défis × 3 étoiles (affiché « x / 630 »). */
export const STAR_TOTAL = 21 * 10 * 3;

/** Origine des minutes du départage (1er janvier 2026, UTC). */
export const RANK_REF_MS = Date.UTC(2026, 0, 1);
/** Étendue du départage en minutes (≈ 19 ans). Au-delà : toutes les dates valent la dernière (jamais d'erreur). */
export const RANK_TIME_SPAN = 10_000_000;

// Chiffres réservés à chaque composante du score étoiles : étoiles | ⭐⭐⭐ | trophées | temps.
const STARS_UNIT = 1e12;
const THREE_UNIT = 1e9;
const TROPHY_UNIT = 1e7; // = RANK_TIME_SPAN

const MAX_STARS = 999;
const MAX_THREE = 999;
const MAX_TROPHIES = 99;

const DAILY_UNIT = RANK_TIME_SPAN;
const MAX_DAILY_WINS = 90_000_000; // 9e7 × 1e7 = 9e14 < 2^53

// ── Temps ────────────────────────────────────────────────────────────────────

/** Minutes écoulées depuis `RANK_REF_MS`, bornées à [0, RANK_TIME_SPAN - 1]. */
export function minutesSinceRef(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.min(RANK_TIME_SPAN - 1, Math.max(0, Math.floor((ms - RANK_REF_MS) / 60_000)));
}

/** Plus c'est ancien, plus la valeur est grande : à score égal, le premier arrivé passe devant. */
function timeInverse(minutes: number): number {
  const m = Math.min(RANK_TIME_SPAN - 1, Math.max(0, Math.floor(minutes)));
  return RANK_TIME_SPAN - 1 - m;
}

/** Minutes (depuis la référence) de la FIN d'un jour `YYYY-MM-DD` UTC : instant où ses victoires sont acquises. */
export function dateEndMinutes(date: string): number {
  const start = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(start)) return 0;
  return minutesSinceRef(start + 86_400_000);
}

const clamp = (n: unknown, max: number): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.min(max, Math.floor(n)) : 0;

// ── Classement des étoiles ───────────────────────────────────────────────────

export interface StarsStanding {
  stars: number;
  threeStars: number;
  trophies: number;
}

/** Score empaqueté du classement des étoiles. Plus grand = mieux classé. */
export function computeStarsRank(s: StarsStanding, reachedAtMin: number): number {
  return (
    clamp(s.stars, MAX_STARS) * STARS_UNIT +
    clamp(s.threeStars, MAX_THREE) * THREE_UNIT +
    clamp(s.trophies, MAX_TROPHIES) * TROPHY_UNIT +
    timeInverse(reachedAtMin)
  );
}

export function unpackStarsRank(rank: number): StarsStanding & { reachedAtMin: number } {
  const r = Math.max(0, Math.floor(rank));
  const stars = Math.floor(r / STARS_UNIT);
  const afterStars = r - stars * STARS_UNIT;
  const threeStars = Math.floor(afterStars / THREE_UNIT);
  const afterThree = afterStars - threeStars * THREE_UNIT;
  const trophies = Math.floor(afterThree / TROPHY_UNIT);
  const inv = afterThree - trophies * TROPHY_UNIT;
  return { stars, threeStars, trophies, reachedAtMin: RANK_TIME_SPAN - 1 - inv };
}

export function sameStanding(a: StarsStanding, b: StarsStanding): boolean {
  return a.stars === b.stars && a.threeStars === b.threeStars && a.trophies === b.trophies;
}

/**
 * Instant d'arrivée à publier. Résultat inchangé → on garde l'instant déjà publié (le joueur ne recule jamais) ;
 * résultat différent ou jamais publié → maintenant.
 */
export function resolveReachedAt(prev: (StarsStanding & { reachedAtMin: number }) | null, next: StarsStanding, nowMin: number): number {
  if (prev && sameStanding(prev, next)) return prev.reachedAtMin;
  return nowMin;
}

// ── Classement du Journalier (par ligue) ─────────────────────────────────────

/** Score empaqueté : victoires du jour dans la ligue, puis le premier arrivé à ce nombre. */
export function computeDailyRank(wins: number, reachedAtMin: number): number {
  return clamp(wins, MAX_DAILY_WINS) * DAILY_UNIT + timeInverse(reachedAtMin);
}

export function unpackDailyRank(rank: number): { wins: number; reachedAtMin: number } {
  const r = Math.max(0, Math.floor(rank));
  const wins = Math.floor(r / DAILY_UNIT);
  return { wins, reachedAtMin: RANK_TIME_SPAN - 1 - (r - wins * DAILY_UNIT) };
}

/** Champs Firestore de `leaderboard/{uid}` pour les victoires du jour d'UNE ligue (jamais mélangées). */
export function dailyWinsField(league: DailyLeague): 'dailyWinsPousse' | 'dailyWinsGrandChene' {
  return league === 'pousse' ? 'dailyWinsPousse' : 'dailyWinsGrandChene';
}
export function dailyRankField(league: DailyLeague): 'dailyRankPousse' | 'dailyRankGrandChene' {
  return league === 'pousse' ? 'dailyRankPousse' : 'dailyRankGrandChene';
}

// ── Entrée publiée (leaderboard/{uid}) ───────────────────────────────────────

export interface LeaderboardEntry {
  userId: string;
  username: string;
  stars: number;
  threeStars: number;
  trophies: number;
  /** Niveaux validés (0 à 21). */
  levelsCompleted: number;
  /** Niveau courant (1 à 21) : sert à afficher le rang forestier (= chapitre). */
  level: number;
  /** Cartes de l'Herbier possédées (affichage seulement : ne départage pas). */
  herbier: number;
  /** Score empaqueté du classement des étoiles. */
  starsRank: number;
}

export interface LeaderboardInput {
  userId: string;
  username: string;
  challengeStars: Record<string, number> | null | undefined;
  /** Trophées obtenus (séries + surprises + final). */
  trophyCount: number;
  levelsCompleted: number;
  herbierCount: number;
}

/** Niveau courant à partir des niveaux validés (même règle que `computeLevelProgress`). */
export function levelFromCompleted(levelsCompleted: number): number {
  return Math.min(21, Math.max(0, Math.floor(levelsCompleted || 0)) + 1);
}

/**
 * Entrée à publier pour le joueur, ou `null` s'il n'y a rien à publier (pas de pseudo, aucune étoile : un joueur sans
 * étoile n'apparaît dans aucun classement). `prev` = la position déjà publiée (pour garder « le premier arrivé »).
 */
export function buildLeaderboardEntry(
  input: LeaderboardInput,
  prev: (StarsStanding & { reachedAtMin: number }) | null,
  nowMs: number,
): LeaderboardEntry | null {
  const username = (input.username ?? '').trim();
  if (!input.userId || !username) return null;
  const standing: StarsStanding = {
    stars: countTotalStars(input.challengeStars),
    threeStars: countThreeStarChallenges(input.challengeStars),
    trophies: clamp(input.trophyCount, MAX_TROPHIES),
  };
  if (standing.stars <= 0) return null;
  const reachedAt = resolveReachedAt(prev, standing, minutesSinceRef(nowMs));
  return {
    userId: input.userId,
    username,
    ...standing,
    levelsCompleted: clamp(input.levelsCompleted, 21),
    level: levelFromCompleted(input.levelsCompleted),
    herbier: clamp(input.herbierCount, 999),
    starsRank: computeStarsRank(standing, reachedAt),
  };
}

/** Une entrée Firestore lue (source non fiable) ; `null` si elle n'a pas de score étoiles (ancienne entrée). */
export function parseLeaderboardEntry(data: unknown): LeaderboardEntry | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.starsRank !== 'number' || !Number.isFinite(d.starsRank) || d.starsRank <= 0) return null;
  if (typeof d.userId !== 'string' || !d.userId) return null;
  const u = unpackStarsRank(d.starsRank);
  const levelsCompleted = clamp(d.levelsCompleted, 21);
  return {
    userId: d.userId,
    username: typeof d.username === 'string' && d.username ? d.username : '—',
    // Les étoiles viennent du score empaqueté (source unique : jamais incohérentes avec le rang)
    stars: u.stars,
    threeStars: u.threeStars,
    trophies: u.trophies,
    levelsCompleted,
    level: levelFromCompleted(levelsCompleted),
    herbier: clamp(d.herbier, 999),
    starsRank: d.starsRank,
  };
}

export interface DailyWinsEntry {
  userId: string;
  username: string;
  wins: number;
  rank: number;
}

/** Une entrée du classement Journalier d'une ligue ; `null` si le joueur n'a aucune victoire dans cette ligue. */
export function parseDailyWinsEntry(data: unknown, league: DailyLeague): DailyWinsEntry | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const rank = d[dailyRankField(league)];
  if (typeof rank !== 'number' || !Number.isFinite(rank) || rank <= 0) return null;
  if (typeof d.userId !== 'string' || !d.userId) return null;
  const { wins } = unpackDailyRank(rank);
  if (wins <= 0) return null;
  return { userId: d.userId, username: typeof d.username === 'string' && d.username ? d.username : '—', wins, rank };
}

/** Rang forestier affiché (chapitre) pour une entrée. */
export function entryForestRank(entry: Pick<LeaderboardEntry, 'level'>) {
  return getRankForLevel(entry.level);
}

// ── Records mondiaux ─────────────────────────────────────────────────────────

export interface WorldRecordLite {
  userId: string;
  username: string;
  /** Instant d'obtention du record (ms) ; 0 si inconnu. */
  achievedAtMs: number;
}

export interface RecordHolderEntry {
  userId: string;
  username: string;
  recordCount: number;
  /** Instant du record détenu le plus récent (ms) : à égalité, le plus ancien passe devant. */
  lastAchievedAtMs: number;
}

/**
 * Classe les détenteurs de records : records détenus (plus = mieux), puis celui dont le dernier record est le plus
 * ancien (il a atteint ce total en premier), puis l'identifiant (ordre stable). Retourne TOUS les détenteurs ; l'écran
 * en affiche `LEADERBOARD_TOP` mais calcule le rang du joueur sur la liste complète.
 */
export function rankRecordHolders(records: readonly WorldRecordLite[]): RecordHolderEntry[] {
  const byUser = new Map<string, RecordHolderEntry>();
  for (const r of records) {
    if (!r.userId) continue;
    const at = Number.isFinite(r.achievedAtMs) && r.achievedAtMs > 0 ? r.achievedAtMs : 0;
    const cur = byUser.get(r.userId);
    if (cur) {
      cur.recordCount += 1;
      cur.lastAchievedAtMs = Math.max(cur.lastAchievedAtMs, at);
    } else {
      byUser.set(r.userId, { userId: r.userId, username: r.username, recordCount: 1, lastAchievedAtMs: at });
    }
  }
  return Array.from(byUser.values()).sort(
    (a, b) =>
      b.recordCount - a.recordCount ||
      a.lastAchievedAtMs - b.lastAchievedAtMs ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );
}

/** Position (1 = premier) d'un joueur dans une liste classée, ou `null`. */
export function positionOf<T extends { userId: string }>(list: readonly T[], userId: string | null | undefined): number | null {
  if (!userId) return null;
  const i = list.findIndex(e => e.userId === userId);
  return i === -1 ? null : i + 1;
}
