// ============================================================
// SOLVEUR — Portage du DLF_Maker.html en TypeScript
// Utilisé UNIQUEMENT à la génération des défis, jamais pendant le gameplay.
// Le gameplay utilise la solution pré-calculée stockée dans Challenge.solution
// ============================================================

import { BoardDefinition } from '../models/Board';
import { ElementDefinition } from '../models/Element';
import { FixedPlacement, TokenCount } from '../models/Challenge';
import { isPlacementValid } from './validator';

export interface SolverInput {
  boardDef: BoardDefinition;
  fixedPlacements: FixedPlacement[];
  availableTokens: TokenCount[];
  elementDefs: Record<string, ElementDefinition>;
}

export interface SolverResult {
  solutions: string[][];  // Toutes les solutions valides trouvées
  solutionCount: number;
  isUnique: boolean;      // true si solutionCount === 1
}

/**
 * Résout le puzzle et retourne toutes les solutions valides.
 * Algorithme : backtracking avec élagage précoce.
 * S'arrête dès que 2 solutions sont trouvées (pour détecter l'unicité).
 */
export function solve(input: SolverInput): SolverResult {
  const { boardDef, fixedPlacements, availableTokens, elementDefs } = input;

  // Initialiser le plateau avec les jetons fixes
  const initialBoard: (string | null)[] = Array(boardDef.cellCount).fill(null);
  for (const fp of fixedPlacements) {
    initialBoard[fp.cellIndex] = fp.elementId;
  }

  // Construire l'inventaire des jetons disponibles
  const tokenInventory: Record<string, number> = {};
  for (const tc of availableTokens) {
    tokenInventory[tc.elementId] = tc.count;
  }

  const solutions: string[][] = [];

  // Lancer le backtracking
  backtrack(initialBoard, tokenInventory, boardDef, elementDefs, solutions);

  return {
    solutions,
    solutionCount: solutions.length,
    isUnique: solutions.length === 1,
  };
}

/**
 * Algorithme de backtracking récursif.
 * S'arrête dès que 2 solutions sont trouvées (optimisation).
 */
function backtrack(
  board: (string | null)[],
  inventory: Record<string, number>,
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>,
  solutions: string[][]
): void {
  // Optimisation : arrêter si on a déjà trouvé 2 solutions
  if (solutions.length >= 2) return;

  // Trouver la première case vide
  const emptyCellIndex = board.findIndex(cell => cell === null);

  // Aucune case vide → solution complète trouvée
  if (emptyCellIndex === -1) {
    // Valider la solution complète (contraintes require notamment)
    if (isCompleteSolutionValid(board as string[], boardDef, elementDefs)) {
      solutions.push([...board] as string[]);
    }
    return;
  }

  // Essayer chaque élément disponible dans l'inventaire
  for (const [elementId, count] of Object.entries(inventory)) {
    if (count <= 0) continue;

    // Vérifier si le placement est valide (contraintes forbid)
    if (!isPlacementValid(emptyCellIndex, elementId, board, boardDef, elementDefs)) {
      continue;
    }

    // Placer l'élément
    board[emptyCellIndex] = elementId;
    inventory[elementId]--;

    // Récursion
    backtrack(board, inventory, boardDef, elementDefs, solutions);

    // Annuler le placement (backtrack)
    board[emptyCellIndex] = null;
    inventory[elementId]++;
  }
}

/**
 * Vérifie les contraintes "require" sur le plateau complet.
 * (ex: chaque chien doit avoir un voisin chien, chaque chalet un bucheron)
 */
function isCompleteSolutionValid(
  board: string[],
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>
): boolean {
  for (let i = 0; i < board.length; i++) {
    const elementId = board[i];
    const elementDef = elementDefs[elementId];
    if (!elementDef) continue;

    const neighbors = boardDef.connections[i];

    for (const constraint of elementDef.constraints) {
      if (constraint.scope !== 'neighbor' || constraint.mode !== 'require') continue;

      switch (constraint.type) {
        case 'neighbor_same': {
          const minCount = constraint.minCount ?? 1;
          const sameCount = neighbors.filter(n => board[n] === elementId).length;
          if (sameCount < minCount) return false;
          break;
        }
        case 'neighbor_specific': {
          const targetId = constraint.targetElementId;
          if (!targetId) break;
          const minCount = constraint.minCount ?? 1;
          const targetCount = neighbors.filter(n => board[n] === targetId).length;
          if (targetCount < minCount) return false;
          break;
        }
        default:
          break;
      }
    }
  }
  return true;
}
