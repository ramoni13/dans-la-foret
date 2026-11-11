// ============================================================
// FORESTIER — PALIERS ET SÉLECTION DES GRILLES (Progression v2, C4 / Lot 5)
//
// Trois paliers de grilles 4×4 :
//   - Sentier   (fin Ch.2) : bûcheron / ours / mouton / loup × 4 — la contrainte ligne/colonne
//                            seule, puis la règle loup/mouton. Grilles ORDONNÉES, de 8 cases
//                            fixées (faciles) à 5 ;
//   - Clairière (fin Ch.3) : compositions avec ruche et/ou cerf/biche, SANS champignon ;
//   - Profonde  (fin Ch.4) : compositions avec champignon.
//
// Un joueur joue dans le palier ouvert LE PLUS ÉLEVÉ qui lui reste des grilles à faire ; quand il
// l'a épuisé, on redescend au palier précédent.
//
// Fichier PUR (aucune dépendance React / Zustand / Firebase / JSON) : testé par
// __tests__/onfTiers.test.ts. La liste des grilles est passée par l'appelant.
// ============================================================

export type OnfTier = 'sentier' | 'clairiere' | 'profonde';

/** Du plus accessible au plus avancé. */
export const ONF_TIER_ORDER: readonly OnfTier[] = ['sentier', 'clairiere', 'profonde'];

/**
 * Paliers dont les grilles se jouent DANS L'ORDRE du fichier (progression de difficulté voulue).
 * Les autres paliers tirent une grille au hasard.
 */
export const ONF_ORDERED_TIERS: readonly OnfTier[] = ['sentier'];

/** Composition du Sentier : exactement 4 types, 4 exemplaires chacun (carré latin 4×4). */
export const SENTIER_COMPOSITION: Readonly<Record<string, number>> = {
  bucheron: 4, ours: 4, mouton: 4, loup: 4,
};

/** Éléments qui définissent le palier d'une composition (hors Sentier). */
export const CLAIRIERE_MARKER_ELEMENTS: readonly string[] = ['ruche', 'cerf', 'biche'];
export const PROFONDE_MARKER_ELEMENT = 'champignon';

export function isOnfTier(value: unknown): value is OnfTier {
  return value === 'sentier' || value === 'clairiere' || value === 'profonde';
}

/**
 * Palier d'une composition (nombre d'exemplaires par élément) :
 *   champignon présent                      → profonde ;
 *   ruche, cerf ou biche présents           → clairiere ;
 *   sinon (4 types de base uniquement)      → sentier.
 */
export function getTierForComposition(composition: Readonly<Record<string, number>>): OnfTier {
  const has = (id: string) => (composition[id] ?? 0) > 0;
  if (has(PROFONDE_MARKER_ELEMENT)) return 'profonde';
  if (CLAIRIERE_MARKER_ELEMENTS.some(has)) return 'clairiere';
  return 'sentier';
}

/** Rang d'un palier (0 = Sentier). */
export function getTierRank(tier: OnfTier): number {
  return ONF_TIER_ORDER.indexOf(tier);
}

/** Palier ouvert le plus élevé, ou null si aucun n'est ouvert. */
export function getHighestOpenTier(openTiers: readonly OnfTier[]): OnfTier | null {
  let best: OnfTier | null = null;
  for (const tier of openTiers) {
    if (isOnfTier(tier) && (best === null || getTierRank(tier) > getTierRank(best))) best = tier;
  }
  return best;
}

export interface TieredChallenge {
  id: string;
  tier?: OnfTier;
}

export interface OnfSelection<T> {
  /** Grille sélectionnée, ou null s'il n'y en a pas à proposer. */
  challenge: T | null;
  /** true quand le joueur a terminé TOUTES les grilles, tous paliers confondus. */
  allCompleted: boolean;
  /**
   * true quand le joueur a terminé toutes les grilles de ses paliers ouverts alors qu'il en reste
   * dans des paliers encore verrouillés : il faut avancer en solo pour débloquer la suite.
   */
  tierExhausted: boolean;
}

/**
 * Choisit la prochaine grille.
 *   - ne considère que les grilles des paliers ouverts, non terminées ;
 *   - privilégie le palier ouvert le plus élevé qui a encore une grille à faire ;
 *   - palier ordonné (Sentier) : la première grille non terminée dans l'ordre du fichier ;
 *     sinon : tirage aléatoire.
 *
 * @param pool        toutes les grilles, dans l'ordre du fichier
 * @param completedIds identifiants déjà terminés
 * @param openTiers   paliers ouverts (voir `getOpenOnfTiers` dans unlocks.ts)
 * @param rng         générateur dans [0, 1) — injectable pour les tests
 */
export function selectOnfChallenge<T extends TieredChallenge>(
  pool: readonly T[],
  completedIds: readonly string[] | null | undefined,
  openTiers: readonly OnfTier[],
  rng: () => number = Math.random,
): OnfSelection<T> {
  const completed = new Set(completedIds ?? []);
  const remaining = pool.filter(c => !completed.has(c.id));
  if (remaining.length === 0) {
    return { challenge: null, allCompleted: true, tierExhausted: false };
  }

  const open = new Set(openTiers.filter(isOnfTier));
  // Les grilles sans palier (anciennes données) sont traitées comme « profonde » : le palier le plus avancé,
  // donc jamais proposées avant d'être ouvert.
  const tierOf = (c: T): OnfTier => (isOnfTier(c.tier) ? c.tier : 'profonde');

  const byHighest = [...open].sort((a, b) => getTierRank(b) - getTierRank(a));
  for (const tier of byHighest) {
    const candidates = remaining.filter(c => tierOf(c) === tier);
    if (candidates.length === 0) continue;
    const ordered = ONF_ORDERED_TIERS.includes(tier);
    const index = ordered ? 0 : Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
    return { challenge: candidates[index], allCompleted: false, tierExhausted: false };
  }

  return { challenge: null, allCompleted: false, tierExhausted: true };
}

/** Nombre de grilles d'un ensemble de paliers. */
export function countChallengesInTiers<T extends TieredChallenge>(
  pool: readonly T[],
  tiers: readonly OnfTier[],
): number {
  const set = new Set(tiers);
  return pool.filter(c => set.has(isOnfTier(c.tier) ? c.tier : 'profonde')).length;
}
