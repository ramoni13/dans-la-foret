// ============================================================
// HELPERS CARTES À COLLECTIONNER ONF — Herbier de la Forêt
// Calcul de la progression et des cartes débloquées.
// ============================================================

import { TREES_DATA, TreeCard } from '../data/treesData';
import { ONF_CARD_UNLOCK_EVERY } from '../constants/onf';

/**
 * Nombre de cartes débloquées en fonction du nombre de défis ONF réussis.
 * Plafonné à TREES_DATA.length (100).
 */
export function getUnlockedCardCount(onfSolvedCount: number): number {
  return Math.min(TREES_DATA.length, Math.floor(onfSolvedCount / ONF_CARD_UNLOCK_EVERY));
}

/**
 * Liste des cartes débloquées (tranche 0..unlockedCount).
 */
export function getUnlockedCards(onfSolvedCount: number): TreeCard[] {
  return TREES_DATA.slice(0, getUnlockedCardCount(onfSolvedCount));
}

/**
 * Prochaine carte à débloquer (null si collection complète).
 */
export function getNextCard(onfSolvedCount: number): TreeCard | null {
  return TREES_DATA[getUnlockedCardCount(onfSolvedCount)] ?? null;
}

/**
 * Retourne la carte nouvellement débloquée si un palier vient d'être franchi,
 * null sinon (pas de palier franchi ou collection déjà complète).
 */
export function getJustUnlockedCard(countBefore: number, countAfter: number): TreeCard | null {
  const cardsBefore = getUnlockedCardCount(countBefore);
  const cardsAfter  = getUnlockedCardCount(countAfter);
  if (cardsAfter > cardsBefore) return TREES_DATA[cardsAfter - 1] ?? null;
  return null;
}

/**
 * Progression vers la prochaine carte.
 * { current: défis effectués depuis le dernier palier, total: ONF_CARD_UNLOCK_EVERY }
 */
export function getCardProgress(onfSolvedCount: number): { current: number; total: number } {
  return {
    current: onfSolvedCount % ONF_CARD_UNLOCK_EVERY,
    total:   ONF_CARD_UNLOCK_EVERY,
  };
}
