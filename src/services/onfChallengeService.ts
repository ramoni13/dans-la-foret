// ============================================================
// SERVICE MODE ONF — Grille Forestière 4×4 (Sudoku Forestier)
//
// Les 100 défis sont pré-générés (scripts/generateOnfChallenges.ts)
// et stockés dans src/data/onf_challenges.json.
//
// Sélection : un défi est tiré au hasard parmi ceux que le joueur
// n'a pas encore terminés (completedOnfChallengeIds).
//
// Quand tous les défis sont terminés : retourne null avec
// allCompleted=true — l'écran affiche un message de félicitations.
// ============================================================

import { Challenge } from '../core/models/Challenge';
import onfChallengesData from '../data/onf_challenges.json';

// Cast du JSON vers Challenge[]
const ONF_CHALLENGES: Challenge[] = onfChallengesData as unknown as Challenge[];

// ── Sélection aléatoire ───────────────────────────────────────────────────────

export interface OnfPickResult {
  /** Le défi sélectionné, ou null si tous sont terminés. */
  challenge: Challenge | null;
  /** true quand le joueur a terminé tous les défis disponibles. */
  allCompleted: boolean;
}

/**
 * Sélectionne un défi ONF aléatoire parmi les défis non encore complétés.
 *
 * @param completedIds  IDs des défis déjà terminés par ce joueur.
 * @returns             OnfPickResult — le défi ou allCompleted=true.
 */
export function pickOnfChallenge(completedIds: string[]): OnfPickResult {
  const completedSet = new Set(completedIds);
  const available = ONF_CHALLENGES.filter(c => !completedSet.has(c.id));

  if (available.length === 0) {
    return { challenge: null, allCompleted: true };
  }

  const index = Math.floor(Math.random() * available.length);
  return { challenge: available[index], allCompleted: false };
}

/**
 * Nombre total de défis ONF disponibles.
 */
export function getTotalOnfChallenges(): number {
  return ONF_CHALLENGES.length;
}

// ── Récompense ────────────────────────────────────────────────────────────────

/**
 * 4×4 : 5 graines de base + 2 bonus si résolu en moins de 120 s.
 */
export function calculateOnfReward(elapsedMs: number): number {
  return 5 + (elapsedMs < 120_000 ? 2 : 0);
}
