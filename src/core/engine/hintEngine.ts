// ============================================================
// MOTEUR DE BONUS / INDICES
// ============================================================

import { TokenCount } from '../models/Challenge';
import { ElementDefinition } from '../models/Element';
import { BoardDefinition } from '../models/Board';
import { getConnectedGroup } from './validator';

/**
 * 💡 Bonus « Cases valides » :
 * Retourne les indices des cases vides où placer cet élément
 * ne viole AUCUNE règle avec les jetons déjà posés sur le plateau.
 *
 * ⚠️ N'utilise PAS la solution — ne donne pas la réponse.
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
    if (playerBoard[cellIndex] !== null) continue;

    // ── Vérification des règles de placement (placementRules) ──────────
    if (elementDef.placementRules) {
      let placementOk = true;
      for (const rule of elementDef.placementRules) {
        let allowed: number[];
        switch (rule.type) {
          case 'center_only':
            allowed = rule.allowedCells ?? boardDef.specialCells?.center ?? [];
            break;
          case 'edge_only':
            allowed = rule.allowedCells ?? boardDef.specialCells?.edges ?? [];
            break;
          case 'corner_only':
            allowed = rule.allowedCells ?? boardDef.specialCells?.corners ?? [];
            break;
          case 'cell_whitelist':
            allowed = rule.allowedCells ?? [];
            break;
          default:
            allowed = [];
        }
        if (!allowed.includes(cellIndex)) { placementOk = false; break; }
      }
      if (!placementOk) continue;
    }

    const neighbors = boardDef.connections[cellIndex] ?? [];
    let cellOk = true;

    for (const constraint of elementDef.constraints) {
      if (constraint.scope !== 'neighbor') continue;

      switch (constraint.type) {
        case 'neighbor_same': {
          if (constraint.mode === 'forbid') {
            const hasSameNeighbor = neighbors.some(n => playerBoard[n] === elementId);
            if (hasSameNeighbor) { cellOk = false; }
          }
          if (constraint.mode === 'require') {
            const hasSameNeighbor = neighbors.some(n => playerBoard[n] === elementId);
            if (!hasSameNeighbor) { cellOk = false; }
          }
          break;
        }

        case 'neighbor_specific': {
          const targetId = constraint.targetElementId;
          if (!targetId) break;
          if (constraint.mode === 'forbid') {
            const hasForbiddenNeighbor = neighbors.some(n => playerBoard[n] === targetId);
            if (hasForbiddenNeighbor) { cellOk = false; }
          }
          if (constraint.mode === 'require') {
            // Si conditionnel, ne restreindre que si le target est déjà posé
            if (constraint.onlyIfTargetOnBoard) {
              const targetPlaced = playerBoard.some(el => el === targetId);
              if (!targetPlaced) break; // target pas encore sur le plateau → pas de restriction
            }
            const hasTargetNeighbor = neighbors.some(n => playerBoard[n] === targetId);
            if (!hasTargetNeighbor) { cellOk = false; }
          }
          break;
        }

        case 'neighbor_specific_chain': {
          const targetId = constraint.targetElementId;
          if (!targetId) break;
          const hasTarget = neighbors.some(n => playerBoard[n] === targetId);
          if (!hasTarget) { cellOk = false; break; }
          const chainId = constraint.chainTargetElementId;
          if (chainId) {
            const chainOnBoard = playerBoard.some(el => el === chainId);
            if (chainOnBoard) {
              const hasChain = neighbors.some(n => playerBoard[n] === chainId);
              if (!hasChain) { cellOk = false; }
            }
          }
          break;
        }

        case 'connected_group': {
          const existingPositions = playerBoard.reduce<number[]>((acc, el, idx) => {
            if (el === elementId) acc.push(idx);
            return acc;
          }, []);
          if (existingPositions.length > 0) {
            const group = getConnectedGroup(
              existingPositions[0], elementId, playerBoard, boardDef
            );
            const isAdjacentToGroup = neighbors.some(n => group.has(n));
            if (!isAdjacentToGroup) { cellOk = false; }
          }
          break;
        }

        case 'paired_specific': {
          const partnerId = constraint.targetElementId;
          if (!partnerId) break;
          const partnerNeighborCount = neighbors.filter(
            n => playerBoard[n] === partnerId
          ).length;
          if (partnerNeighborCount !== 1) { cellOk = false; }
          break;
        }

        default:
          break;
      }

      if (!cellOk) break;
    }

    if (!cellOk) continue;

    // Vérifier que les voisins déjà posés ne sont pas violés
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
 * 🔴 Bonus « Instinct » :
 * Compare le plateau du joueur avec la solution et retourne
 * les indices des cases NON FIXES où le jeton posé est INCORRECT.
 * Les cases vides sont ignorées (pas d'erreur si rien n'est posé).
 */
export function getErrorCells(
  playerBoard: (string | null)[],
  solution: string[],
  fixedCellIndices: Set<number>
): number[] {
  const errors: number[] = [];
  for (let i = 0; i < playerBoard.length; i++) {
    if (fixedCellIndices.has(i)) continue;        // case fixe → jamais en erreur
    if (playerBoard[i] === null) continue;         // case vide → pas d'erreur
    if (playerBoard[i] !== solution[i]) {
      errors.push(i);
    }
  }
  return errors;
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
