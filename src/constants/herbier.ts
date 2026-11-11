// ============================================================
// HERBIER — logique pure (Progression v2, C6 / Lot 7)
//
// L'Herbier est la collection de cartes d'arbres du joueur. Source de vérité des cartes possédées :
// `playerStore.collectedTreeCardIds` (et non plus `onfSolvedCount`).
//
// Trois façons d'obtenir une carte :
//   - PLANTER : le joueur choisit une carte parmi les régions ouvertes et la paie en graines
//               (coût croissant : `getPlantCost`) ;
//   - gratuite — fin de chapitre : une carte de la région qui vient de s'ouvrir (la suivante de la
//               région), ou une carte légendaire au chapitre 7 ;
//   - gratuite — Forestier : une carte toutes les `ONF_CARD_UNLOCK_EVERY` grilles résolues.
//
// Les régions : 'france' (ouverte dès le départ), puis 'europe' (fin ch.5), 'monde' (fin ch.6),
// 'remarquables' (fin ch.7), selon les déblocages de `progression.ts`.
//
// Fichier PUR (aucune dépendance React / Zustand / Firebase / require d'images) : les cartes sont
// passées par l'appelant. Testé par __tests__/herbier.test.ts.
// ============================================================

import type { HerbierRegion } from './progression';
import { ONF_CARD_UNLOCK_EVERY } from './onf';

/** Sous-ensemble d'une carte utile à la logique (indépendant des images et des textes). */
export interface HerbierCardRef {
  id: number;
  region: HerbierRegion;
}

/** Régions, de la plus accessible à la plus avancée. */
export const HERBIER_REGIONS: readonly HerbierRegion[] = ['france', 'europe', 'monde', 'remarquables'];

export function isHerbierRegion(value: unknown): value is HerbierRegion {
  return value === 'france' || value === 'europe' || value === 'monde' || value === 'remarquables';
}

// ── Coût de plantation (D5) ───────────────────────────────────────────────────

/** Coût de base d'une carte, en graines. */
export const PLANT_BASE_COST = 30;
/** Surcoût par palier de `PLANT_COST_STEP_EVERY` cartes possédées. */
export const PLANT_COST_STEP = 5;
export const PLANT_COST_STEP_EVERY = 10;

/**
 * Coût de plantation : `30 + 5 × floor(nbCartesPossédées / 10)` graines.
 * 0 à 9 cartes : 30 ; 10 à 19 : 35 ; … ; 100 cartes : 80.
 */
export function getPlantCost(ownedCount: number): number {
  const owned = Math.max(0, Math.floor(Number.isFinite(ownedCount) ? ownedCount : 0));
  return PLANT_BASE_COST + PLANT_COST_STEP * Math.floor(owned / PLANT_COST_STEP_EVERY);
}

// ── Régions ouvertes ──────────────────────────────────────────────────────────

/**
 * Régions ouvertes. `isRegionFeatureOpen` indique si le déblocage de la région est atteint
 * (fourni par l'appelant depuis `isFeatureUnlocked`) : la France est TOUJOURS ouverte.
 * Avec le contournement de développement, tout est ouvert.
 */
export function getOpenRegions(
  isRegionFeatureOpen: (region: Exclude<HerbierRegion, 'france'>) => boolean,
  bypass = false,
): HerbierRegion[] {
  if (bypass) return [...HERBIER_REGIONS];
  const open: HerbierRegion[] = ['france'];
  if (isRegionFeatureOpen('europe')) open.push('europe');
  if (isRegionFeatureOpen('monde')) open.push('monde');
  if (isRegionFeatureOpen('remarquables')) open.push('remarquables');
  return open;
}

/** Nom de la fonctionnalité de déblocage d'une région (`isFeatureUnlocked`), null pour la France. */
export function getRegionFeature(
  region: HerbierRegion,
): 'herbier_europe' | 'herbier_monde' | 'herbier_remarquables' | null {
  switch (region) {
    case 'europe': return 'herbier_europe';
    case 'monde': return 'herbier_monde';
    case 'remarquables': return 'herbier_remarquables';
    default: return null;
  }
}

// ── Cartes possédées / à planter ──────────────────────────────────────────────

/** Identifiants valides, sans doublon : ignore les valeurs corrompues et les cartes inexistantes. */
export function sanitizeCollectedIds(
  ids: readonly number[] | null | undefined,
  pool: readonly HerbierCardRef[],
): number[] {
  const valid = new Set(pool.map(c => c.id));
  const out: number[] = [];
  for (const id of ids ?? []) {
    if (Number.isInteger(id) && valid.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Fusion de deux listes de cartes possédées (union). Une carte ne se perd jamais. */
export function mergeCollectedIds(
  a: readonly number[] | null | undefined,
  b: readonly number[] | null | undefined,
): number[] {
  const out: number[] = [];
  for (const list of [a, b]) {
    for (const id of list ?? []) {
      if (Number.isInteger(id) && id > 0 && !out.includes(id)) out.push(id);
    }
  }
  return out.sort((x, y) => x - y);
}

/** Cartes encore à obtenir dans les régions ouvertes, dans l'ordre du pool. */
export function getPlantableCards<T extends HerbierCardRef>(
  pool: readonly T[],
  ownedIds: readonly number[] | null | undefined,
  openRegions: readonly HerbierRegion[],
): T[] {
  const owned = new Set(ownedIds ?? []);
  const open = new Set(openRegions);
  return pool.filter(c => !owned.has(c.id) && open.has(c.region));
}

export type PlantRefusal =
  | 'unknown_card'      // identifiant inexistant
  | 'already_owned'     // déjà possédée
  | 'region_locked'     // région pas encore ouverte
  | 'not_enough_seeds'; // graines insuffisantes

export interface PlantCheck {
  ok: boolean;
  /** Coût demandé (même en cas de refus : pour l'affichage). */
  cost: number;
  reason?: PlantRefusal;
}

/** Peut-on planter cette carte ? Ne modifie rien : la dépense est faite par le store (`spendSeeds`). */
export function checkPlant(
  cardId: number,
  pool: readonly HerbierCardRef[],
  ownedIds: readonly number[] | null | undefined,
  openRegions: readonly HerbierRegion[],
  seeds: number,
): PlantCheck {
  const cost = getPlantCost((ownedIds ?? []).length);
  const card = pool.find(c => c.id === cardId);
  if (!card) return { ok: false, cost, reason: 'unknown_card' };
  if ((ownedIds ?? []).includes(cardId)) return { ok: false, cost, reason: 'already_owned' };
  if (!openRegions.includes(card.region)) return { ok: false, cost, reason: 'region_locked' };
  if (seeds < cost) return { ok: false, cost, reason: 'not_enough_seeds' };
  return { ok: true, cost };
}

// ── Cartes gratuites ──────────────────────────────────────────────────────────

/**
 * Carte offerte à la fin d'un chapitre : la PREMIÈRE carte non possédée de la région visée, dans
 * l'ordre du pool. `legendary` (chapitre 7) vise les cartes « remarquables ».
 * Une région épuisée offre la première carte non possédée d'une région ouverte, sinon rien.
 *
 * `preferRegion` : région que le chapitre vient d'ouvrir (ch.5 → europe, ch.6 → monde, ch.7 →
 * remarquables) ; sans région d'ouverture (ch.1 à 4), la France.
 */
export function pickChapterCard<T extends HerbierCardRef>(
  pool: readonly T[],
  ownedIds: readonly number[] | null | undefined,
  preferRegion: HerbierRegion,
  openRegions: readonly HerbierRegion[],
): T | null {
  const owned = new Set(ownedIds ?? []);
  const free = pool.filter(c => !owned.has(c.id));
  const inRegion = free.find(c => c.region === preferRegion);
  if (inRegion) return inRegion;
  const open = new Set(openRegions);
  return free.find(c => open.has(c.region)) ?? null;
}

/** Région dont un chapitre offre une carte : celle qu'il ouvre, la France sinon. */
export function getChapterCardRegion(chapterId: number): HerbierRegion {
  switch (chapterId) {
    case 5: return 'europe';
    case 6: return 'monde';
    case 7: return 'remarquables';
    default: return 'france';
  }
}

// ── Forestier : 1 carte toutes les N grilles ─────────────────────────────────

/** Nombre de cartes gratuites gagnées par `onfSolvedCount` grilles résolues. */
export function getOnfCardsEarned(onfSolvedCount: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(onfSolvedCount) ? onfSolvedCount : 0));
  return Math.floor(n / ONF_CARD_UNLOCK_EVERY);
}

/**
 * true si passer de `countBefore` à `countAfter` grilles franchit un palier de carte gratuite.
 * Un seul palier par grille résolue : la grille qui fait passer de 4 à 5 offre une carte.
 */
export function crossedOnfCardThreshold(countBefore: number, countAfter: number): boolean {
  return getOnfCardsEarned(countAfter) > getOnfCardsEarned(countBefore);
}

/** Progression vers la prochaine carte gratuite du Forestier : `current / total`. */
export function getOnfCardProgress(onfSolvedCount: number): { current: number; total: number } {
  const n = Math.max(0, Math.floor(Number.isFinite(onfSolvedCount) ? onfSolvedCount : 0));
  return { current: n % ONF_CARD_UNLOCK_EVERY, total: ONF_CARD_UNLOCK_EVERY };
}

// ── Cartes « nouvelles » (badge rouge de l'Herbier) ───────────────────────────
// Une carte est NOUVELLE tant que le joueur n'a pas affiché sa collection depuis qu'il l'a obtenue
// (plantation, fin de chapitre ou grille du Forestier). Le badge rouge de « Ma collection » compte ces cartes.

/** Cartes possédées que le joueur n'a pas encore vues dans sa collection (ids valides, sans doublon). */
export function getUnseenCardIds(
  ownedIds: readonly number[] | null | undefined,
  seenIds: readonly number[] | null | undefined,
): number[] {
  const seen = new Set(seenIds ?? []);
  const out: number[] = [];
  for (const id of ownedIds ?? []) {
    if (Number.isInteger(id) && id > 0 && !seen.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Nombre de cartes nouvelles : valeur du badge rouge (0 = pas de badge). */
export function countUnseenCards(
  ownedIds: readonly number[] | null | undefined,
  seenIds: readonly number[] | null | undefined,
): number {
  return getUnseenCardIds(ownedIds, seenIds).length;
}

/**
 * Collection après consultation : toutes les cartes possédées sont « vues ». Union avec les cartes déjà vues
 * (une carte vue le reste), triée. Renvoie la MÊME référence si rien ne change (aucun rendu inutile).
 */
export function markCardsSeen(
  ownedIds: readonly number[] | null | undefined,
  seenIds: readonly number[],
): readonly number[] {
  if (getUnseenCardIds(ownedIds, seenIds).length === 0) return seenIds;
  return mergeCollectedIds(seenIds, ownedIds);
}

/** Libellé du badge : « 9+ » au-delà de 9, pour tenir dans la pastille. */
export function formatBadgeCount(count: number): string {
  return count > 9 ? '9+' : String(Math.max(0, Math.floor(count)));
}

// ── Progression de la collection ──────────────────────────────────────────────

export interface HerbierProgress {
  owned: number;
  total: number;
  /** owned / total, 0 à 1. */
  ratio: number;
  complete: boolean;
}

export function getHerbierProgress(
  pool: readonly HerbierCardRef[],
  ownedIds: readonly number[] | null | undefined,
): HerbierProgress {
  const valid = new Set(pool.map(c => c.id));
  const owned = new Set((ownedIds ?? []).filter(id => valid.has(id))).size;
  const total = pool.length;
  return { owned, total, ratio: total > 0 ? owned / total : 0, complete: total > 0 && owned >= total };
}

/** Progression par région. */
export function getRegionProgress(
  pool: readonly HerbierCardRef[],
  ownedIds: readonly number[] | null | undefined,
  region: HerbierRegion,
): HerbierProgress {
  return getHerbierProgress(pool.filter(c => c.region === region), ownedIds);
}

/**
 * Prochaine carte « à découvrir » affichée en silhouette sur l'accueil : la première carte non
 * possédée d'une région ouverte, ou null (collection des régions ouvertes complète).
 */
export function getNextSilhouette<T extends HerbierCardRef>(
  pool: readonly T[],
  ownedIds: readonly number[] | null | undefined,
  openRegions: readonly HerbierRegion[],
): T | null {
  return getPlantableCards(pool, ownedIds, openRegions)[0] ?? null;
}
