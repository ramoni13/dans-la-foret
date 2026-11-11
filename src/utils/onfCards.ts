// ============================================================
// HELPERS HERBIER — catalogue des cartes et accès (Progression v2, Lot 7)
//
// SOURCE DE VÉRITÉ des cartes possédées : `playerStore.collectedTreeCardIds` (et NON plus
// `onfSolvedCount`, dont l'ancien calcul `floor(n / 5)` débloquait les cartes dans l'ordre du fichier).
//
// Ce fichier fait le lien entre le catalogue de 143 cartes et la logique pure
// de `src/constants/herbier.ts`. Les cartes sont offertes de trois façons (voir herbier.ts) :
// plantation payante, carte de fin de chapitre, carte gratuite toutes les 5 grilles du Forestier.
// ============================================================

import { TREES_DATA, TreeCard } from '../data/treesData';
import {
  HerbierProgress,
  getHerbierProgress,
  getNextSilhouette,
  getOnfCardProgress,
} from '../constants/herbier';
import type { HerbierRegion } from '../constants/progression';

/** Les 143 cartes de l'Herbier, classées par région dans `TREES_DATA`. */
export const ALL_TREE_CARDS: readonly TreeCard[] = TREES_DATA;

/** Nombre total de cartes de l'Herbier. */
export const TOTAL_TREE_CARDS = ALL_TREE_CARDS.length;

/** Une carte par identifiant, ou null. */
export function getTreeCard(id: number): TreeCard | null {
  return ALL_TREE_CARDS.find(c => c.id === id) ?? null;
}

/** Cartes possédées, dans l'ordre de leur identifiant. Ignore les identifiants inconnus. */
export function getOwnedCards(collectedIds: readonly number[] | null | undefined): TreeCard[] {
  const owned = new Set(collectedIds ?? []);
  return ALL_TREE_CARDS.filter(c => owned.has(c.id));
}

/** Nombre de cartes possédées (cartes valides, sans doublon). */
export function getOwnedCardCount(collectedIds: readonly number[] | null | undefined): number {
  return getHerbierProgress(ALL_TREE_CARDS, collectedIds).owned;
}

/** Progression de la collection. */
export function getCollectionProgress(collectedIds: readonly number[] | null | undefined): HerbierProgress {
  return getHerbierProgress(ALL_TREE_CARDS, collectedIds);
}

/**
 * Prochaine carte « à découvrir » (silhouette) : la première carte non possédée d'une région ouverte.
 * null quand toutes les cartes des régions ouvertes sont possédées.
 */
export function getNextCard(
  collectedIds: readonly number[] | null | undefined,
  openRegions: readonly HerbierRegion[],
): TreeCard | null {
  return getNextSilhouette(ALL_TREE_CARDS, collectedIds, openRegions);
}

/**
 * Progression vers la prochaine carte gratuite du Forestier (1 toutes les ONF_CARD_UNLOCK_EVERY grilles).
 * { current: grilles depuis le dernier palier, total: ONF_CARD_UNLOCK_EVERY }
 */
export function getCardProgress(onfSolvedCount: number): { current: number; total: number } {
  return getOnfCardProgress(onfSolvedCount);
}
