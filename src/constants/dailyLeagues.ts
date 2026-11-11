// ============================================================
// DÉFI DU JOUR — DEUX LIGUES (Progression v2, C5 / Lot 6)
//
//   Pousse      (fin Ch.3) : compositions SANS chalet ni tas_buches ;
//   Grand Chêne (fin Ch.4) : TOUTES les compositions.
//
// Deux grilles par jour : même seed de date, avec un SEL par ligue. Le joueur joue la grille de sa
// ligue LA PLUS HAUTE. Le nombre de cases fixées est IDENTIQUE pour tous les joueurs d'une même
// ligue (on ne dépend plus du niveau du joueur).
//
// Un classement Firestore par ligue et par date : `dailyChallenges/{date}_{ligue}/results/{uid}`.
//
// Fichier PUR (aucune dépendance React / Zustand / Firebase) : testé par __tests__/dailyLeagues.test.ts.
// ============================================================

export type DailyLeague = 'pousse' | 'grand_chene';

/** De la plus accessible à la plus haute. */
export const DAILY_LEAGUE_ORDER: readonly DailyLeague[] = ['pousse', 'grand_chene'];

export function isDailyLeague(value: unknown): value is DailyLeague {
  return value === 'pousse' || value === 'grand_chene';
}

/**
 * Sel de chaque ligue, ajouté au seed de la date : deux grilles différentes le même jour.
 * Constantes figées : les modifier changerait la grille de tous les jours à venir ET passés.
 */
export const DAILY_LEAGUE_SALT: Readonly<Record<DailyLeague, number>> = {
  pousse: 0,
  grand_chene: 1_000_003,
};

/**
 * Cases fixées par ligue, IDENTIQUES pour tous les joueurs de la ligue un jour donné (C5).
 *
 * Mesure (30 jours consécutifs, générateur réel) : `baseFixedCount` — le minimum garantissant
 * l'unicité — vaut entre 4 et 6 selon le jour. Le réglage ci-dessous est donc un PLANCHER :
 * `resolveLeagueFixedCount` prend le max avec `baseFixedCount`, ce qui garantit l'unicité tous les jours.
 *   - Pousse : 6 cases — toujours suffisant (base ≤ 6), donc 6 chaque jour ;
 *   - Grand Chêne : 5 cases — les jours où la base vaut 6, la grille a 6 cases fixées.
 * La difficulté ne dépend jamais du joueur (ni de son niveau) : seulement de la ligue et de la date.
 */
export const DAILY_LEAGUE_FIXED_COUNT: Readonly<Record<DailyLeague, number>> = {
  pousse: 6,
  grand_chene: 5,
};

/** Éléments dont la présence exclut une composition de la Pousse. */
export const POUSSE_EXCLUDED_ELEMENTS: readonly string[] = ['chalet', 'tas_buches'];

/**
 * Composition : nombre d'exemplaires par élément. Structurel : accepte aussi l'interface Composition de
 * difficulty.ts (champs optionnels, sans signature d'index) ainsi qu'un simple Record<string, number>.
 */
export type DailyComposition = object;

/** Une composition est-elle autorisée dans cette ligue ? */
export function isCompositionAllowedInLeague(composition: DailyComposition, league: DailyLeague): boolean {
  if (league === 'grand_chene') return true;
  const counts = composition as Readonly<Record<string, number | undefined>>;
  return POUSSE_EXCLUDED_ELEMENTS.every(el => (counts[el] ?? 0) === 0);
}

/** Compositions d'une ligue, dans l'ordre d'origine. */
export function getLeagueCompositions<T extends DailyComposition>(
  compositions: readonly T[],
  league: DailyLeague,
): T[] {
  return compositions.filter(c => isCompositionAllowedInLeague(c, league));
}

/** Seed d'une ligue : seed de la date + sel. Deux ligues ne partagent jamais le même seed. */
export function getLeagueSeed(dateSeed: number, league: DailyLeague): number {
  return (dateSeed + DAILY_LEAGUE_SALT[league]) | 0;
}

/** Cases fixées effectives : le réglage de la ligue, jamais en dessous du minimum d'unicité de la grille. */
export function resolveLeagueFixedCount(league: DailyLeague, baseFixedCount: number): number {
  return Math.max(DAILY_LEAGUE_FIXED_COUNT[league], baseFixedCount);
}

/**
 * Ligue la plus haute ouverte, ou null si le Journalier n'est pas ouvert.
 * Prend la liste fournie par `getOpenDailyLeagues` (unlocks.ts).
 */
export function getPlayerLeague(openLeagues: readonly DailyLeague[]): DailyLeague | null {
  let best: DailyLeague | null = null;
  for (const league of openLeagues) {
    if (!isDailyLeague(league)) continue;
    if (best === null || DAILY_LEAGUE_ORDER.indexOf(league) > DAILY_LEAGUE_ORDER.indexOf(best)) best = league;
  }
  return best;
}

// ── Identifiants Firestore ────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Identifiant du document-date d'une ligue : `2026-11-06_pousse`. */
export function buildLeagueDocId(date: string, league: DailyLeague): string {
  return `${date}_${league}`;
}

/**
 * Lit un identifiant de document-date. Les anciens documents (`2026-11-06`, sans ligue) renvoient
 * `league: null` : ils datent d'avant la Progression v2 et ne sont pas des classements de ligue.
 */
export function parseLeagueDocId(id: string): { date: string; league: DailyLeague | null } | null {
  if (DATE_RE.test(id)) return { date: id, league: null };
  const sep = id.indexOf('_');
  if (sep !== 10) return null;
  const date = id.slice(0, sep);
  const league = id.slice(sep + 1);
  if (!DATE_RE.test(date) || !isDailyLeague(league)) return null;
  return { date, league };
}

/** Identifiant du défi (`daily_2026-11-06_pousse`), distinct par ligue : sert de clé de chrono local. */
export function buildDailyChallengeKey(date: string, league: DailyLeague): string {
  return `daily_${date}_${league}`;
}

// ── Rang et récompense dans la ligue ─────────────────────────────────────────

export interface LeagueRank {
  /** Rang du joueur dans SA ligue (1 = plus rapide). */
  rank: number;
  /** Participants de la ligue, joueur compris. */
  total: number;
}

/**
 * Rang d'un résultat parmi ceux de SA ligue seulement.
 * `leagueResults` : classement de la ligue, trié par temps croissant, sans le joueur courant.
 * Un temps égal ne passe pas devant un temps déjà enregistré (premier arrivé, premier classé).
 */
export function computeLeagueRank(
  leagueResults: ReadonlyArray<{ userId: string; timeMs: number }>,
  userId: string | null | undefined,
  timeMs: number,
): LeagueRank {
  const others = leagueResults.filter(r => r.userId !== userId);
  const faster = others.filter(r => r.timeMs <= timeMs).length;
  return { rank: faster + 1, total: others.length + 1 };
}
