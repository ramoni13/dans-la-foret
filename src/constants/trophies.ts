// ============================================================
// TROPHÉES — logique pure (Progression v2, C8 / Lot 8)
//
// Les trophées remplacent les badges. Plus de « objectif actif » : TOUT trophée dont la condition est
// remplie est décerné, sans choisir ni activer quoi que ce soit.
//
//   - 15 SÉRIES à 4 paliers (bois, pierre, or, cristal) : la rareté est déterminée par le palier ;
//   - 7 SURPRISES (badges uniques, conservés tels quels) ;
//   - 1 trophée FINAL « Esprit accompli » (fin du chapitre 7).
//
// Identifiants des séries : `{serie}_{palier}` (ex. `constellation_1` … `constellation_4`, palier 1 = bois).
// Le stockage reste `playerStore.earnedBadges` (aucun champ renommé).
//
// Fichier PUR (aucune dépendance React / Zustand / Firebase) : testé par __tests__/trophies.test.ts.
// Chaque série lit UN compteur de `TrophyCounters` ; l'appelant fournit les compteurs à jour.
// ============================================================

export type TrophyRarity = 'bois' | 'pierre' | 'or' | 'cristal';

/** Du palier 1 (bois) au palier 4 (cristal). */
export const TIER_RARITIES: readonly TrophyRarity[] = ['bois', 'pierre', 'or', 'cristal'];

export type TrophyFamily = 'solo' | 'daily' | 'onf' | 'duel' | 'herbier' | 'fidelite';

/**
 * Compteurs lus par les séries. Tous sont des cumuls ou des records qui ne baissent jamais, SAUF
 * `starStreak` (série en cours, remise à 0 par une victoire à ⭐) : un trophée déjà décerné n'est
 * jamais retiré, et le compteur de la série est donc un record (`bestStarStreak`).
 */
export interface TrophyCounters {
  /** Constellation : étoiles cumulées (0 à 630). */
  totalStars: number;
  /** Œil de lynx : meilleure série de victoires ⭐⭐+ d'affilée (1re victoire seulement). */
  bestStarStreak: number;
  /** Main sûre : défis à ⭐⭐⭐. */
  threeStarChallenges: number;
  /** Vif comme le vent : défis gagnés pour la 1re fois en moins de 50 % du temps estimé. */
  quickFirstWins: number;
  /** Persévérant : défis distincts dont la note a été améliorée. */
  improvedStarChallenges: number;
  /** Rendez-vous : victoires au Journalier. */
  dailyWins: number;
  /** Série : meilleure série de jours d'affilée au Journalier. */
  dailyBestStreak: number;
  /** Podium : meilleur résultat au Journalier, voir `PodiumStats`. */
  podium: PodiumStats;
  /** Forestier : grilles résolues. */
  onfSolved: number;
  /** Forestier : grilles sans faute. */
  onfPerfect: number;
  /** Forestier : grilles en moins de 2 minutes. */
  onfExpress: number;
  /** Duel : victoires. */
  duelWins: number;
  /** Rassembleur : amis distincts défiés. */
  friendsChallenged: number;
  /** Botaniste : cartes de l'Herbier. */
  cards: number;
  /** Habitué : meilleure série de jours joués d'affilée. */
  loyaltyBest: number;
  /** Nombre total de grilles du Forestier (palier « toutes »). */
  onfTotal: number;
}

/**
 * Statistiques du podium du Journalier, INCLUSIVES : un n° 1 est aussi un top 3 et un top 10 %.
 * « top 10 % » dépend du nombre de participants de la ligue : il est donc enregistré AU MOMENT de la
 * partie (`recordPodium`), on ne peut pas le recalculer ensuite.
 */
export interface PodiumStats {
  /** Fois dans le top 10 % de sa ligue (inclut les top 3 et les n° 1). */
  top10Percent: number;
  /** Fois dans le top 3 de sa ligue (inclut les n° 1). */
  top3: number;
  /** Fois n° 1 de sa ligue. */
  first: number;
}

export const EMPTY_PODIUM: PodiumStats = { top10Percent: 0, top3: 0, first: 0 };

/** Top 10 % : rang <= ceil(10 % des participants), au moins la 1re place (même formule que la récompense). */
export function isTopTenPercent(rank: number, total: number): boolean {
  return rank >= 1 && total >= 1 && rank <= Math.max(1, Math.ceil(total * 0.10));
}

/** Podium mis à jour après une partie classée `rank` sur `total` participants de la ligue. */
export function recordPodium(stats: PodiumStats, rank: number, total: number): PodiumStats {
  if (!Number.isFinite(rank) || rank < 1) return stats;
  return {
    top10Percent: stats.top10Percent + (isTopTenPercent(rank, total) || rank <= 3 ? 1 : 0),
    top3: stats.top3 + (rank <= 3 ? 1 : 0),
    first: stats.first + (rank === 1 ? 1 : 0),
  };
}

/**
 * Le palier de podium `tier` (1 à 4) est-il atteint ? Chaque palier a SA propre condition :
 *   1. top 10 %  ·  2. top 3  ·  3. top 3 × 5 (cinq podiums)  ·  4. n° 1.
 * Ils sont indépendants : un premier n° 1 donne le palier 4 sans donner le palier 3.
 */
export function isPodiumTierReached(p: PodiumStats, tier: number): boolean {
  switch (tier) {
    case 1: return p.top10Percent >= 1;
    case 2: return p.top3 >= 1;
    case 3: return p.top3 >= 5;
    case 4: return p.first >= 1;
    default: return false;
  }
}

/** Plus haut palier de podium atteint (0 à 4), pour l'affichage. */
export function readPodiumTier(p: PodiumStats): number {
  let best = 0;
  for (const tier of [1, 2, 3, 4]) if (isPodiumTierReached(p, tier)) best = tier;
  return best;
}

/** Progression du podium vers le palier `tier`, `current / target`. */
export function getPodiumProgress(p: PodiumStats, tier: number): { current: number; target: number } {
  switch (tier) {
    case 1: return { current: Math.min(1, p.top10Percent), target: 1 };
    case 2: return { current: Math.min(1, p.top3), target: 1 };
    case 3: return { current: Math.min(5, p.top3), target: 5 };
    default: return { current: Math.min(1, p.first), target: 1 };
  }
}
export interface TrophySeries {
  /** Préfixe des identifiants : `{id}_{1..4}`. */
  id: string;
  family: TrophyFamily;
  emoji: string;
  /** Clés i18n de la série (`trophy_{id}_name`) et de la condition (`trophy_{id}_desc`). */
  nameKey: string;
  descKey: string;
  /** Seuils des 4 paliers, croissants. Pour le Podium : seuils sur les sous-compteurs, voir `readPodiumTier`. */
  thresholds: readonly [number, number, number, number];
  /** Valeur courante de la série pour des compteurs donnés (valeur comparée aux seuils). */
  read: (c: TrophyCounters) => number;
  /**
   * Palier atteint ? Seulement pour les séries dont les paliers ne sont PAS monotones (Podium). Par défaut :
   * `read(c) >= seuil`.
   */
  reached?: (c: TrophyCounters, tier: number) => boolean;
  /** Unité d'affichage de la progression (`count` par défaut). */
  unit?: 'count' | 'times';
}

/** Les 15 séries de la spec (C8), dans l'ordre d'affichage. */
export const TROPHY_SERIES: readonly TrophySeries[] = [
  // ── Solo ───────────────────────────────────────────────────
  { id: 'constellation', family: 'solo', emoji: '✨', nameKey: 'trophy_constellation_name', descKey: 'trophy_constellation_desc',
    thresholds: [50, 150, 350, 630], read: c => c.totalStars },
  { id: 'lynx', family: 'solo', emoji: '🐱', nameKey: 'trophy_lynx_name', descKey: 'trophy_lynx_desc',
    thresholds: [5, 10, 25, 50], read: c => c.bestStarStreak },
  { id: 'main_sure', family: 'solo', emoji: '🎯', nameKey: 'trophy_main_sure_name', descKey: 'trophy_main_sure_desc',
    thresholds: [3, 10, 25, 50], read: c => c.threeStarChallenges },
  { id: 'vif', family: 'solo', emoji: '💨', nameKey: 'trophy_vif_name', descKey: 'trophy_vif_desc',
    thresholds: [1, 10, 30, 100], read: c => c.quickFirstWins },
  { id: 'perseverant', family: 'solo', emoji: '🔄', nameKey: 'trophy_perseverant_name', descKey: 'trophy_perseverant_desc',
    thresholds: [1, 5, 20, 50], read: c => c.improvedStarChallenges },
  // ── Journalier ─────────────────────────────────────────────
  { id: 'rendez_vous', family: 'daily', emoji: '📅', nameKey: 'trophy_rendez_vous_name', descKey: 'trophy_rendez_vous_desc',
    thresholds: [1, 10, 50, 100], read: c => c.dailyWins },
  { id: 'serie', family: 'daily', emoji: '🔥', nameKey: 'trophy_serie_name', descKey: 'trophy_serie_desc',
    thresholds: [3, 7, 30, 100], read: c => c.dailyBestStreak },
  { id: 'podium', family: 'daily', emoji: '🏅', nameKey: 'trophy_podium_name', descKey: 'trophy_podium_desc',
    thresholds: [1, 2, 3, 4], read: c => readPodiumTier(c.podium), reached: (c, tier) => isPodiumTierReached(c.podium, tier) },
  // ── Forestier ──────────────────────────────────────────────
  { id: 'grilles', family: 'onf', emoji: '🗺️', nameKey: 'trophy_grilles_name', descKey: 'trophy_grilles_desc',
    // 4e palier = TOUTES les grilles : le seuil est le nombre total, lu dans les compteurs (voir getSeriesThresholds)
    thresholds: [1, 10, 50, 130], read: c => c.onfSolved },
  { id: 'sans_faute', family: 'onf', emoji: '🎖️', nameKey: 'trophy_sans_faute_name', descKey: 'trophy_sans_faute_desc',
    thresholds: [1, 5, 20, 50], read: c => c.onfPerfect },
  { id: 'express', family: 'onf', emoji: '⚡', nameKey: 'trophy_express_name', descKey: 'trophy_express_desc',
    thresholds: [1, 5, 20, 50], read: c => c.onfExpress },
  // ── Duel ───────────────────────────────────────────────────
  { id: 'duel', family: 'duel', emoji: '🤝', nameKey: 'trophy_duel_name', descKey: 'trophy_duel_desc',
    thresholds: [5, 20, 50, 100], read: c => c.duelWins },
  { id: 'rassembleur', family: 'duel', emoji: '👥', nameKey: 'trophy_rassembleur_name', descKey: 'trophy_rassembleur_desc',
    thresholds: [1, 5, 10, 25], read: c => c.friendsChallenged },
  // ── Herbier ────────────────────────────────────────────────
  { id: 'botaniste', family: 'herbier', emoji: '🌿', nameKey: 'trophy_botaniste_name', descKey: 'trophy_botaniste_desc',
    thresholds: [10, 25, 50, 100], read: c => c.cards },
  // ── Fidélité ───────────────────────────────────────────────
  { id: 'habitue', family: 'fidelite', emoji: '📆', nameKey: 'trophy_habitue_name', descKey: 'trophy_habitue_desc',
    thresholds: [3, 7, 30, 100], read: c => c.loyaltyBest },
];

/** Identifiant du trophée du palier `tier` (1 à 4) d'une série. */
export function buildTrophyId(seriesId: string, tier: number): string {
  return `${seriesId}_${tier}`;
}

/** Lit `{serie}_{palier}`, ou null si ce n'est pas un trophée de série. */
export function parseTrophyId(id: string): { seriesId: string; tier: number } | null {
  const m = /^([a-z_]+)_([1-4])$/.exec(id);
  if (!m) return null;
  return TROPHY_SERIES.some(s => s.id === m[1]) ? { seriesId: m[1], tier: parseInt(m[2], 10) } : null;
}

export function getSeries(seriesId: string): TrophySeries | null {
  return TROPHY_SERIES.find(s => s.id === seriesId) ?? null;
}

/**
 * Seuils effectifs d'une série. « Grilles résolues » : le dernier palier est le NOMBRE TOTAL de grilles
 * du Forestier (« toutes »), fourni par les compteurs pour rester juste si le catalogue évolue.
 */
export function getSeriesThresholds(series: TrophySeries, counters: Pick<TrophyCounters, 'onfTotal'>): readonly number[] {
  if (series.id === 'grilles') return [series.thresholds[0], series.thresholds[1], series.thresholds[2], Math.max(series.thresholds[2] + 1, counters.onfTotal)];
  return series.thresholds;
}

// ── Surprises (badges uniques conservés tels quels) ──────────────────────────

/** Identifiants des surprises : conservés EXACTEMENT, pour que les musiques et les textes restent valables. */
export const SURPRISE_IDS: readonly string[] = [
  'secret_fantome', 'secret_noel', 'secret_paques', 'secret_boucle', 'secret_coeur_brise',
  'saisonnier_automne', 'saisonnier_hiver', 'saisonnier_printemps', 'saisonnier_ete',
  'record_first', 'record_mondial',
  'regularite_lune', 'regularite_soleil',
  'ami_de_la_foret',
];

/** Trophée final, décerné à la fin du chapitre 7. */
export const FINAL_TROPHY = 'esprit_accompli';

// ── Évaluation ────────────────────────────────────────────────────────────────

/**
 * Trophées de série nouvellement atteints : tous les paliers franchis et pas déjà possédés.
 * IDEMPOTENT. Les paliers manqués sont décernés d'un coup (un compteur qui saute de 0 à 12 donne les
 * paliers 1 et 2). Aucun « objectif actif » : tout ce qui est atteint est décerné.
 */
export function evaluateSeriesTrophies(
  counters: TrophyCounters,
  earned: readonly string[] | null | undefined,
): string[] {
  const have = new Set(earned ?? []);
  const out: string[] = [];
  for (const series of TROPHY_SERIES) {
    const value = series.read(counters);
    const thresholds = getSeriesThresholds(series, counters);
    for (let i = 0; i < 4; i++) {
      const id = buildTrophyId(series.id, i + 1);
      const ok = series.reached ? series.reached(counters, i + 1) : value >= thresholds[i];
      if (ok && !have.has(id) && !out.includes(id)) out.push(id);
    }
  }
  return out;
}

/** Le trophée final est-il atteint ? (fin du chapitre 7 = 21 niveaux validés) */
export function isFinalTrophyReached(levelsCompleted: number): boolean {
  return levelsCompleted >= 21;
}

/** Trophée final à décerner (liste de 0 ou 1 identifiant), idempotent. */
export function evaluateFinalTrophy(levelsCompleted: number, earned: readonly string[] | null | undefined): string[] {
  return isFinalTrophyReached(levelsCompleted) && !(earned ?? []).includes(FINAL_TROPHY) ? [FINAL_TROPHY] : [];
}

/** Palier de rareté d'un trophée de série (1 bois … 4 cristal), null hors série. */
export function getTrophyRarity(id: string): TrophyRarity | null {
  const p = parseTrophyId(id);
  return p ? TIER_RARITIES[p.tier - 1] : null;
}

// ── Prochains trophées (suggestions) ──────────────────────────────────────────

export interface TrophyProgress {
  trophyId: string;
  seriesId: string;
  tier: number;
  current: number;
  target: number;
  /** current / target, 0 à 1. */
  percentage: number;
}

/**
 * Pour chaque série, le PROCHAIN palier à atteindre et sa progression. Les séries terminées (4 paliers)
 * n'en proposent plus.
 */
export function getNextTierProgress(
  counters: TrophyCounters,
  earned: readonly string[] | null | undefined,
): TrophyProgress[] {
  const have = new Set(earned ?? []);
  const out: TrophyProgress[] = [];
  for (const series of TROPHY_SERIES) {
    const thresholds = getSeriesThresholds(series, counters);
    const next = [1, 2, 3, 4].find(tier => !have.has(buildTrophyId(series.id, tier)));
    if (!next) continue;
    let current: number;
    let target: number;
    if (series.id === 'podium') {
      ({ current, target } = getPodiumProgress(counters.podium, next));
    } else {
      current = Math.min(series.read(counters), thresholds[next - 1]);
      target = thresholds[next - 1];
    }
    out.push({
      trophyId: buildTrophyId(series.id, next),
      seriesId: series.id,
      tier: next,
      current,
      target,
      percentage: target > 0 ? Math.min(1, current / target) : 0,
    });
  }
  return out;
}

/**
 * Les `limit` (3) « prochains trophées » les plus proches, avec leur barre de progression : triés par
 * pourcentage décroissant, puis par palier croissant, puis par ordre du catalogue. Les trophées à 0 %
 * ne sont proposés que s'il n'y a rien de mieux.
 */
export function getClosestTrophies(
  counters: TrophyCounters,
  earned: readonly string[] | null | undefined,
  limit = 3,
): TrophyProgress[] {
  const order = new Map(TROPHY_SERIES.map((s, i) => [s.id, i]));
  return getNextTierProgress(counters, earned)
    .sort((a, b) =>
      b.percentage - a.percentage
      || a.tier - b.tier
      || (order.get(a.seriesId) ?? 0) - (order.get(b.seriesId) ?? 0))
    .slice(0, limit);
}

/** Seuil du palier `tier` d'une série (pour l'affichage « Gagner N … »), ou undefined. */
export function getTierTarget(seriesId: string, tier: number, onfTotal = 130): number | undefined {
  const series = getSeries(seriesId);
  if (!series || tier < 1 || tier > 4) return undefined;
  return getSeriesThresholds(series, { onfTotal })[tier - 1];
}

/** Nombre total de trophées de série (15 × 4). */
export const TOTAL_SERIES_TROPHIES = TROPHY_SERIES.length * 4;

/** Tous les identifiants de trophées de série. */
export function getAllSeriesTrophyIds(): string[] {
  return TROPHY_SERIES.flatMap(s => [1, 2, 3, 4].map(t => buildTrophyId(s.id, t)));
}
