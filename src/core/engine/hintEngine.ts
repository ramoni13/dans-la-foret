// ============================================================
// MOTEUR DE BONUS / INDICES
// ============================================================

import { TokenCount } from '../models/Challenge';
import { ElementDefinition } from '../models/Element';
import { BoardDefinition } from '../models/Board';

/**
 * 💡 Bonus 1 : Cases POSSIBLES pour un élément donné.
 *
 * Retourne les indices des cases vides où placer cet élément
 * ne viole AUCUNE règle avec les jetons déjà posés sur le plateau.
 *
 * ⚠️ N'utilise PAS la solution — ne donne pas la réponse.
 * Le joueur voit les cases légalement jouables, pas la bonne case.
 *
 * Règles vérifiées (état ACTUEL du plateau uniquement) :
 *  - neighbor_same / forbid      → aucun voisin déjà posé n'est le même élément
 *  - neighbor_same / require     → au moins un voisin déjà posé est le même élément
 *  - neighbor_specific / forbid  → aucun voisin déjà posé n'est l'élément cible
 *  - neighbor_specific / require → au moins un voisin déjà posé est l'élément cible
 *
 * ⚠️ Les cases voisines LIBRES ne comptent PAS pour valider un "require".
 *    Le bonus montre ce qui est légal MAINTENANT, pas ce qui pourrait l'être.
 *    Ex : chien → uniquement les cases directement voisines d'un chien déjà posé.
 *    Ex : chalet → uniquement les cases directement voisines d'un bucheron déjà posé.
 *
 * On exclut aussi les cases déjà occupées.
 */
export function getValidCellsForElement(
  elementId: string,
  playerBoard: (string | null)[],
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>
): number[] {
  const elementDef = elementDefs[elementId];
  if (!elementDef) return [];

  const result: number[] = [];

  for (let cellIndex = 0; cellIndex < playerBoard.length; cellIndex++) {
    // Case déjà occupée → impossible
    if (playerBoard[cellIndex] !== null) continue;

    const neighbors = boardDef.connections[cellIndex] ?? [];
    let cellOk = true;

    for (const constraint of elementDef.constraints) {
      if (constraint.scope !== 'neighbor') continue;

      switch (constraint.type) {
        case 'neighbor_same': {
          if (constraint.mode === 'forbid') {
            // Interdit si un voisin déjà posé est le même élément
            const hasSameNeighbor = neighbors.some(
              n => playerBoard[n] === elementId
            );
            if (hasSameNeighbor) { cellOk = false; }
          }
          if (constraint.mode === 'require') {
            // Valide UNIQUEMENT si un voisin déjà posé est le même élément.
            // Les cases voisines libres ne comptent pas.
            const hasSameNeighbor = neighbors.some(
              n => playerBoard[n] === elementId
            );
            if (!hasSameNeighbor) { cellOk = false; }
          }
          break;
        }

        case 'neighbor_specific': {
          const targetId = constraint.targetElementId;
          if (!targetId) break;

          if (constraint.mode === 'forbid') {
            // Interdit si un voisin déjà posé est l'élément cible
            const hasForbiddenNeighbor = neighbors.some(
              n => playerBoard[n] === targetId
            );
            if (hasForbiddenNeighbor) { cellOk = false; }
          }
          if (constraint.mode === 'require') {
            // Valide UNIQUEMENT si un voisin déjà posé est l'élément cible.
            // Les cases voisines libres ne comptent pas.
            const hasTargetNeighbor = neighbors.some(
              n => playerBoard[n] === targetId
            );
            if (!hasTargetNeighbor) { cellOk = false; }
          }
          break;
        }

        default:
          break;
      }

      if (!cellOk) break;
    }

    if (!cellOk) continue;

    // Vérifier aussi que les voisins déjà posés ne sont pas violés
    // par l'arrivée de cet élément (contraintes symétriques)
    for (const neighborIdx of neighbors) {
      const neighborId = playerBoard[neighborIdx];
      if (!neighborId) continue;
      const neighborDef = elementDefs[neighborId];
      if (!neighborDef) continue;

      for (const constraint of neighborDef.constraints) {
        if (constraint.scope !== 'neighbor') continue;

        if (
          constraint.type === 'neighbor_specific' &&
          constraint.targetElementId === elementId &&
          constraint.mode === 'forbid'
        ) {
          cellOk = false;
          break;
        }
        if (
          constraint.type === 'neighbor_same' &&
          neighborId === elementId &&
          constraint.mode === 'forbid'
        ) {
          cellOk = false;
          break;
        }
      }
      if (!cellOk) break;
    }

    if (cellOk) result.push(cellIndex);
  }

  return result;
}

/**
 * ❌ Bonus 2 : Cases impossibles pour tous les éléments restants.
 * Retourne les indices des cases vides qui ne correspondent à aucun
 * des éléments encore disponibles dans l'inventaire du joueur.
 */
export function getImpossibleCells(
  solution: string[],
  playerBoard: (string | null)[],
  remainingTokens: TokenCount[]
): number[] {
  const remainingElementIds = new Set(
    remainingTokens.filter(t => t.count > 0).map(t => t.elementId)
  );

  return solution.reduce<number[]>((acc, el, i) => {
    if (playerBoard[i] === null && !remainingElementIds.has(el)) {
      acc.push(i);
    }
    return acc;
  }, []);
}

/**
 * 🔍 Bonus 3 : Révéler une case vide au hasard.
 * Retourne l'index et l'elementId de la solution pour une case vide aléatoire.
 */
export function revealRandomCell(
  solution: string[],
  playerBoard: (string | null)[]
): { cellIndex: number; elementId: string } | null {
  const emptyCells = playerBoard.reduce<number[]>((acc, el, i) => {
    if (el === null) acc.push(i);
    return acc;
  }, []);

  if (emptyCells.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * emptyCells.length);
  const cellIndex = emptyCells[randomIndex];

  return { cellIndex, elementId: solution[cellIndex] };
}

/**
 * ✅ Bonus 4 : Vérifier l'état actuel du plateau.
 * Compare chaque case placée par le joueur avec la solution.
 * Retourne les cases correctes et incorrectes.
 */
export function checkCurrentState(
  playerBoard: (string | null)[],
  solution: string[]
): { correctCells: number[]; incorrectCells: number[] } {
  const correctCells: number[] = [];
  const incorrectCells: number[] = [];

  for (let i = 0; i < playerBoard.length; i++) {
    const playerEl = playerBoard[i];
    if (playerEl === null) continue; // Case vide, on ignore

    if (playerEl === solution[i]) {
      correctCells.push(i);
    } else {
      incorrectCells.push(i);
    }
  }

  return { correctCells, incorrectCells };
}

/**
 * Calcule le nombre de graines gagnées après résolution.
 */
export function calculateSeedReward(
  elapsedMs: number,
  estimatedDurationMs: number,
  bonusUsed: string[]
): number {
  let seeds = 10; // Récompense de base

  // Bonus rapidité : < 50% du temps estimé
  if (elapsedMs < estimatedDurationMs * 0.5) {
    seeds += 5;
  }

  // Pénalité par bonus utilisé
  seeds -= bonusUsed.length * 2;

  return Math.max(seeds, 1); // Minimum 1 graine
}
