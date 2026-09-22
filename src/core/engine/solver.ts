// ============================================================
// SOLVEUR — Portage du DLF_Maker.html en TypeScript
// Utilisé UNIQUEMENT à la génération des défis, jamais pendant le gameplay.
// Le gameplay utilise la solution pré-calculée stockée dans Challenge.solution
//
// RÈGLE ABSOLUE D'UNICITÉ :
//   Un défi est valide si et seulement si solutionCount === 1.
//   Ni 0 (défi impossible), ni 2+ (défi ambigu).
// ============================================================

import { BoardDefinition } from '../models/Board';
import { ElementDefinition } from '../models/Element';
import { FixedPlacement, TokenCount } from '../models/Challenge';
import { isPlacementValid, getConnectedGroup } from './validator';

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

  const rawSolutions: string[][] = [];

  // Lancer le backtracking
  backtrack(initialBoard, tokenInventory, boardDef, elementDefs, rawSolutions);

  // Dédupliquer les solutions canoniquement :
  // Deux solutions sont identiques du point de vue du joueur si elles
  // placent les mêmes éléments aux mêmes cases, indépendamment de l'ordre
  // dans lequel le backtracking les a découvertes.
  // Ex : chien en case 3 puis case 4 == chien en case 4 puis case 3
  // → on normalise chaque solution en une clé canonique unique.
  const seen = new Set<string>();
  const solutions: string[][] = [];
  for (const sol of rawSolutions) {
    const key = canonicalKey(sol);
    if (!seen.has(key)) {
      seen.add(key);
      solutions.push(sol);
    }
  }

  return {
    solutions,
    solutionCount: solutions.length,
    isUnique: solutions.length === 1,
  };
}

/**
 * Clé canonique d'une solution pour la déduplication.
 * Pour chaque type d'élément, les positions sont triées → deux solutions
 * qui ne diffèrent que par l'échange de jetons identiques donnent la même clé.
 * Ex : [chien, ours, chien] et [chien, ours, chien] (cases 0↔2 échangées)
 *   → même clé car les positions des chiens sont {0,2} dans les deux cas.
 */
function canonicalKey(solution: string[]): string {
  // Grouper les indices par elementId
  const positions: Record<string, number[]> = {};
  for (let i = 0; i < solution.length; i++) {
    const el = solution[i];
    if (!positions[el]) positions[el] = [];
    positions[el].push(i);
  }
  // Trier les positions de chaque élément, puis sérialiser
  return Object.keys(positions)
    .sort()
    .map(el => el + ':' + positions[el].sort((a, b) => a - b).join(','))
    .join('|');
}

/**
 * Mélange Fisher-Yates sur les entrées d'un Record<string, number>.
 * Utilisé pour randomiser l'ordre d'essai des éléments dans le backtracking.
 */
function shuffleEntries(obj: Record<string, number>): [string, number][] {
  const entries = Object.entries(obj);
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  return entries;
}

/**
 * Élagage précoce des contraintes 'require'.
 * Après chaque placement, vérifie si les contraintes 'require' encore
 * non satisfaites peuvent encore l'être (voisins vides disponibles
 * ET jetons restants suffisants).
 * Si une contrainte 'require' est déjà impossible à satisfaire,
 * on élague la branche immédiatement sans explorer davantage.
 */
function canStillSatisfyRequireConstraints(
  board: (string | null)[],
  inventory: Record<string, number>,
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>
): boolean {
  for (let i = 0; i < board.length; i++) {
    const elementId = board[i];
    if (!elementId) continue;
    const elementDef = elementDefs[elementId];
    if (!elementDef) continue;
    const neighbors = boardDef.connections[i];

    for (const constraint of elementDef.constraints) {
      if (constraint.scope !== 'neighbor' || constraint.mode !== 'require') continue;

      if (constraint.type === 'neighbor_same') {
        const minCount = constraint.minCount ?? 1;
        const alreadySatisfied = neighbors.filter(n => board[n] === elementId).length;
        if (alreadySatisfied >= minCount) continue; // déjà satisfait
        // Peut-on encore satisfaire ? Voisins vides + jetons restants
        const emptyNeighbors = neighbors.filter(n => board[n] === null).length;
        const remaining = inventory[elementId] ?? 0;
        if (emptyNeighbors === 0 || remaining === 0) return false; // impossible
      }

      if (constraint.type === 'neighbor_specific') {
        const targetId = constraint.targetElementId;
        if (!targetId) continue;
        const minCount = constraint.minCount ?? 1;
        const alreadySatisfied = neighbors.filter(n => board[n] === targetId).length;
        if (alreadySatisfied >= minCount) continue;
        const emptyNeighbors = neighbors.filter(n => board[n] === null).length;
        const remaining = inventory[targetId] ?? 0;
        if (emptyNeighbors === 0 || remaining === 0) return false;
      }

      // neighbor_specific_chain : vérifier que la contrainte principale
      // (targetElementId) peut encore être satisfaite.
      if (constraint.type === 'neighbor_specific_chain') {
        const targetId = constraint.targetElementId;
        if (!targetId) continue;
        const alreadySatisfied = neighbors.filter(n => board[n] === targetId).length;
        if (alreadySatisfied >= 1) continue;
        const emptyNeighbors = neighbors.filter(n => board[n] === null).length;
        const remaining = inventory[targetId] ?? 0;
        if (emptyNeighbors === 0 || remaining === 0) return false;
      }
    }
  }
  return true;
}

/**
 * Algorithme de backtracking récursif.
 * S'arrête dès que 2 solutions sont trouvées (optimisation unicité).
 * Intègre un élagage précoce des contraintes 'require' pour éviter
 * d'explorer des branches condamnées d'avance.
 */
function backtrack(
  board: (string | null)[],
  inventory: Record<string, number>,
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>,
  solutions: string[][]
): void {
  // Optimisation : arrêter si on a déjà trouvé 2 solutions
  // (on cherche uniquement à détecter l'unicité : 0, 1 ou 2+)
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
  // Fix 3.1 : ordre randomisé → brise le biais déterministe (Object.entries
  // retourne toujours les clés dans l'ordre d'insertion en V8, ce qui fait
  // que le premier élément de l'inventaire se retrouve systématiquement
  // placé dans les cases de faible index).
  for (const [elementId, count] of shuffleEntries(inventory)) {
    if (count <= 0) continue;

    // Vérifier si le placement est valide (contraintes forbid)
    if (!isPlacementValid(emptyCellIndex, elementId, board, boardDef, elementDefs)) {
      continue;
    }

    // Placer l'élément
    board[emptyCellIndex] = elementId;
    inventory[elementId]--;

    // Élagage précoce : vérifier si les contraintes 'require' sont
    // encore satisfaisables avant de continuer la récursion
    if (canStillSatisfyRequireConstraints(board, inventory, boardDef, elementDefs)) {
      backtrack(board, inventory, boardDef, elementDefs, solutions);
    }

    // Annuler le placement (backtrack)
    board[emptyCellIndex] = null;
    inventory[elementId]++;
  }
}

/**
 * Valide une solution complète contre toutes les contraintes :
 *   - neighbor_same / require     : voisin identique requis
 *   - neighbor_specific / require : voisin spécifique requis
 *   - neighbor_specific_chain     : voisin requis + voisin conditionnel
 *   - connected_group             : tous les exemplaires forment 1 groupe connexe
 *   - paired_specific             : couplage 1-pour-1 (cerf/biche)
 */
function isCompleteSolutionValid(
  board: string[],
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>
): boolean {

  // ── Passe 1 : contraintes de voisinage case par case ────────────────────
  for (let i = 0; i < board.length; i++) {
    const elementId = board[i];
    const elementDef = elementDefs[elementId];
    if (!elementDef) continue;

    const neighbors = boardDef.connections[i];

    for (const constraint of elementDef.constraints) {
      if (constraint.scope !== 'neighbor') continue;

      switch (constraint.type) {
        case 'neighbor_same': {
          if (constraint.mode !== 'require') break;
          const minCount = constraint.minCount ?? 1;
          const sameCount = neighbors.filter(n => board[n] === elementId).length;
          if (sameCount < minCount) return false;
          break;
        }
        case 'neighbor_specific': {
          if (constraint.mode !== 'require') break;
          const targetId = constraint.targetElementId;
          if (!targetId) break;
          const minCount = constraint.minCount ?? 1;
          const targetCount = neighbors.filter(n => board[n] === targetId).length;
          if (targetCount < minCount) return false;
          break;
        }
        case 'neighbor_specific_chain': {
          // Contrainte principale : doit être voisin de targetElementId
          const targetId = constraint.targetElementId;
          if (!targetId) break;
          const hasTarget = neighbors.some(n => board[n] === targetId);
          if (!hasTarget) return false;
          // Contrainte conditionnelle : si chainTargetElementId est présent
          const chainId = constraint.chainTargetElementId;
          if (chainId) {
            const chainOnBoard = board.some(el => el === chainId);
            if (chainOnBoard) {
              const hasChain = neighbors.some(n => board[n] === chainId);
              if (!hasChain) return false;
            }
          }
          break;
        }
        default:
          break;
      }
    }
  }

  // ── Passe 2 : contraintes globales (une fois par type d'élément) ────────
  const checkedGlobalTypes = new Set<string>();

  for (let i = 0; i < board.length; i++) {
    const elementId = board[i];
    if (checkedGlobalTypes.has(elementId)) continue;
    const elementDef = elementDefs[elementId];
    if (!elementDef) continue;

    for (const constraint of elementDef.constraints) {

      // connected_group : tous les exemplaires forment 1 seul groupe connexe
      if (constraint.type === 'connected_group') {
        const allPositions = board.reduce<number[]>((acc, el, idx) => {
          if (el === elementId) acc.push(idx);
          return acc;
        }, []);
        if (allPositions.length > 1) {
          const group = getConnectedGroup(allPositions[0], elementId, board, boardDef);
          if (group.size !== allPositions.length) return false;
        }
        checkedGlobalTypes.add(elementId);
      }

      // paired_specific : couplage 1-pour-1 avec targetElementId
      if (constraint.type === 'paired_specific') {
        const partnerId = constraint.targetElementId;
        if (!partnerId) continue;
        const myPositions = board.reduce<number[]>((acc, el, idx) => {
          if (el === elementId) acc.push(idx);
          return acc;
        }, []);
        const partnerPositions = board.reduce<number[]>((acc, el, idx) => {
          if (el === partnerId) acc.push(idx);
          return acc;
        }, []);
        // Counts égaux
        if (myPositions.length !== partnerPositions.length) return false;
        // Exactement 1 voisin partenaire par exemplaire
        for (const pos of myPositions) {
          const partnerNeighborCount = boardDef.connections[pos].filter(
            n => board[n] === partnerId
          ).length;
          if (partnerNeighborCount !== 1) return false;
        }
        checkedGlobalTypes.add(elementId);
      }
    }
  }

  return true;
}
