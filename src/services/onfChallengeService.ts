// ============================================================
// SERVICE MODE ONF — Grille Forestière 4×4 (Sudoku Forestier)
//
// Les grilles sont pré-générées (scripts/generateOnfChallenges.ts) et stockées dans
// src/data/onf_challenges.json. Chacune porte un palier (`tier`) : sentier, clairiere, profonde
// (Progression v2, C4). La logique de sélection est pure et testée : src/constants/onfTiers.ts.
//
// Sélection : parmi les grilles non terminées des paliers OUVERTS, on joue dans le palier ouvert le
// plus élevé qui en a encore (Sentier : dans l'ordre de difficulté ; autres : au hasard).
// Quand les paliers ouverts sont épuisés mais que d'autres restent verrouillés, `tierExhausted`
// invite à avancer en solo ; quand tout est terminé, `allCompleted`.
// ============================================================

import { Challenge } from '../core/models/Challenge';
import onfChallengesData from '../data/onf_challenges.json';
import {
  OnfTier,
  ONF_TIER_ORDER,
  TieredChallenge,
  countChallengesInTiers,
  selectOnfChallenge,
} from '../constants/onfTiers';

/** Une grille ONF : un défi + son palier. */
export type OnfChallenge = Challenge & { tier: OnfTier };

// Cast du JSON vers OnfChallenge[]
const ONF_CHALLENGES: OnfChallenge[] = onfChallengesData as unknown as OnfChallenge[];

// ── Sélection ─────────────────────────────────────────────────────────────────

export interface OnfPickResult {
  /** Le défi sélectionné, ou null s'il n'y en a pas à proposer. */
  challenge: OnfChallenge | null;
  /** true quand le joueur a terminé TOUTES les grilles, tous paliers confondus. */
  allCompleted: boolean;
  /** true quand les paliers ouverts sont épuisés alors que d'autres restent à débloquer. */
  tierExhausted: boolean;
}

/**
 * Sélectionne la prochaine grille ONF.
 *
 * @param completedIds  IDs des défis déjà terminés par ce joueur.
 * @param unlockedTiers Paliers ouverts (voir `getOpenOnfTiers`). Par défaut : tous (anciens appelants,
 *                      scripts) — un écran de jeu doit TOUJOURS passer les paliers réellement ouverts.
 */
export function pickOnfChallenge(
  completedIds: string[],
  unlockedTiers: readonly OnfTier[] = ONF_TIER_ORDER,
): OnfPickResult {
  const r = selectOnfChallenge<OnfChallenge>(ONF_CHALLENGES, completedIds, unlockedTiers);
  return { challenge: r.challenge, allCompleted: r.allCompleted, tierExhausted: r.tierExhausted };
}

/** Nombre total de grilles ONF disponibles (tous paliers). */
export function getTotalOnfChallenges(): number {
  return ONF_CHALLENGES.length;
}

/** Nombre de grilles des paliers ouverts (dénominateur de la progression affichée). */
export function getOnfChallengeCount(tiers: readonly OnfTier[] = ONF_TIER_ORDER): number {
  return countChallengesInTiers<TieredChallenge>(ONF_CHALLENGES, tiers);
}

/** Toutes les grilles (lecture seule) — pour les tests et les écrans de statistiques. */
export function getAllOnfChallenges(): readonly OnfChallenge[] {
  return ONF_CHALLENGES;
}

// ── Récompense ────────────────────────────────────────────────────────────────

/**
 * 4×4 : 5 graines de base + 2 bonus si résolu en moins de 120 s.
 */
export function calculateOnfReward(elapsedMs: number): number {
  return 5 + (elapsedMs < 120_000 ? 2 : 0);
}