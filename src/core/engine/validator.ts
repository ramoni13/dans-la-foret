// ============================================================
// VALIDATEUR DE RÈGLES
// Vérifie les contraintes déclarées dans ElementDefinition.
// Aucune règle n'est codée en dur ici.
// ============================================================

import { BoardDefinition } from '../models/Board';
import { ElementDefinition, ConstraintType } from '../models/Element';

export interface ValidationResult {
  isValid: boolean;
  violations: Violation[];
}

export interface Violation {
  cellIndex: number;
  elementId: string;
  constraintType: ConstraintType;
  message: string;
}

/**
 * Vérifie si le plateau complet respecte toutes les règles.
 * Lit les contraintes depuis ElementDefinition — rien de codé en dur.
 */
export function validateBoard(
  board: (string | null)[],
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>
): ValidationResult {
  const violations: Violation[] = [];

  for (let i = 0; i < board.length; i++) {
    const elementId = board[i];
    if (!elementId) continue;

    const elementDef = elementDefs[elementId];
    if (!elementDef) continue;

    const neighbors = boardDef.connections[i];

    for (const constraint of elementDef.constraints) {
      if (constraint.scope !== 'neighbor') continue;

      switch (constraint.type) {
        case 'neighbor_same': {
          const sameNeighbors = neighbors.filter(n => board[n] === elementId);
          if (constraint.mode === 'forbid' && sameNeighbors.length > 0) {
            violations.push({
              cellIndex: i,
              elementId,
              constraintType: 'neighbor_same',
              message: `${elementDef.label} ne peut pas être voisin d'un autre ${elementDef.label}`,
            });
          }
          if (constraint.mode === 'require') {
            const minCount = constraint.minCount ?? 1;
            if (sameNeighbors.length < minCount) {
              violations.push({
                cellIndex: i,
                elementId,
                constraintType: 'neighbor_same',
                message: `${elementDef.label} doit avoir au moins ${minCount} voisin(s) ${elementDef.label}`,
              });
            }
          }
          break;
        }

        case 'neighbor_specific': {
          const targetId = constraint.targetElementId;
          if (!targetId) break;
          const targetNeighbors = neighbors.filter(n => board[n] === targetId);
          const targetDef = elementDefs[targetId];
          const targetLabel = targetDef?.label ?? targetId;

          if (constraint.mode === 'forbid' && targetNeighbors.length > 0) {
            violations.push({
              cellIndex: i,
              elementId,
              constraintType: 'neighbor_specific',
              message: `${elementDef.label} ne peut pas être voisin de ${targetLabel}`,
            });
          }
          if (constraint.mode === 'require') {
            const minCount = constraint.minCount ?? 1;
            if (targetNeighbors.length < minCount) {
              violations.push({
                cellIndex: i,
                elementId,
                constraintType: 'neighbor_specific',
                message: `${elementDef.label} doit avoir au moins ${minCount} voisin(s) ${targetLabel}`,
              });
            }
          }
          break;
        }

        default:
          break;
      }
    }

    // Vérification des règles de placement
    if (elementDef.placementRules) {
      for (const rule of elementDef.placementRules) {
        if (rule.type === 'cell_whitelist' || rule.type === 'center_only') {
          const allowed = rule.allowedCells ?? boardDef.specialCells?.center ?? [];
          if (!allowed.includes(i)) {
            violations.push({
              cellIndex: i,
              elementId,
              constraintType: 'position_only',
              message: `${elementDef.label} ne peut être placé qu'à des positions spécifiques`,
            });
          }
        }
      }
    }
  }

  return { isValid: violations.length === 0, violations };
}

/**
 * Vérifie si le plateau du joueur correspond à la solution pré-calculée.
 * Implémentation : simple comparaison O(n) — pas de calcul.
 */
export function checkVictory(
  playerBoard: (string | null)[],
  solution: string[]
): boolean {
  if (playerBoard.length !== solution.length) return false;
  return playerBoard.every((el, i) => el === solution[i]);
}

/**
 * Vérifie si un placement individuel est valide (utilisé pendant le drag).
 * Vérifie uniquement les voisins déjà placés — pas la solution complète.
 */
export function isPlacementValid(
  cellIndex: number,
  elementId: string,
  currentBoard: (string | null)[],
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>
): boolean {
  const elementDef = elementDefs[elementId];
  if (!elementDef) return false;

  const neighbors = boardDef.connections[cellIndex];

  for (const constraint of elementDef.constraints) {
    if (constraint.scope !== 'neighbor') continue;

    switch (constraint.type) {
      case 'neighbor_same': {
        if (constraint.mode === 'forbid') {
          const hasSameNeighbor = neighbors.some(n => currentBoard[n] === elementId);
          if (hasSameNeighbor) return false;
        }
        break;
      }
      case 'neighbor_specific': {
        const targetId = constraint.targetElementId;
        if (!targetId) break;
        if (constraint.mode === 'forbid') {
          const hasForbiddenNeighbor = neighbors.some(n => currentBoard[n] === targetId);
          if (hasForbiddenNeighbor) return false;
        }
        break;
      }
      default:
        break;
    }
  }

  // Vérifier aussi que les voisins existants ne sont pas violés par ce placement
  for (const neighborIdx of neighbors) {
    const neighborId = currentBoard[neighborIdx];
    if (!neighborId) continue;
    const neighborDef = elementDefs[neighborId];
    if (!neighborDef) continue;

    for (const constraint of neighborDef.constraints) {
      if (constraint.scope !== 'neighbor') continue;
      if (constraint.type === 'neighbor_specific' && constraint.targetElementId === elementId) {
        if (constraint.mode === 'forbid') return false;
      }
      if (constraint.type === 'neighbor_same' && neighborId === elementId) {
        if (constraint.mode === 'forbid') return false;
      }
    }
  }

  return true;
}
