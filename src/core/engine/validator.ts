// ============================================================
// VALIDATEUR DE RÈGLES
// Vérifie les contraintes déclarées dans ElementDefinition.
// Aucune règle n'est codée en dur ici.
//
// Types de contraintes supportés :
//   neighbor_same            → forbid/require voisin identique
//   neighbor_specific        → forbid/require voisin d'un type donné
//   neighbor_specific_chain  → voisin requis + voisin conditionnel (tas_buches)
//   connected_group          → tous les exemplaires forment 1 groupe connexe (chien)
//   paired_specific          → couplage 1-pour-1 avec un autre type (cerf/biche)
// ============================================================

import { BoardDefinition } from '../models/Board';
import { ElementDefinition, ConstraintType } from '../models/Element';

// ── Utilitaire : BFS pour trouver un groupe connexe ──────────────────────────
/**
 * Retourne tous les indices du groupe connexe contenant `startIndex`,
 * en ne traversant que les cases occupées par `elementId`.
 * Exporté pour être réutilisé dans le solveur.
 */
export function getConnectedGroup(
  startIndex: number,
  elementId: string,
  board: (string | null)[],
  boardDef: BoardDefinition
): Set<number> {
  const visited = new Set<number>();
  const queue = [startIndex];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const neighbor of boardDef.connections[current]) {
      if (!visited.has(neighbor) && board[neighbor] === elementId) {
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

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

        // ── neighbor_specific_chain ───────────────────────────────────────
        // Voisin requis (targetElementId) TOUJOURS
        // + voisin requis (chainTargetElementId) SI présent sur le plateau.
        // Ex : tas_buches → voisin bucheron toujours
        //                 → voisin chalet si chalet présent sur le plateau
        case 'neighbor_specific_chain': {
          const targetId = constraint.targetElementId;
          if (!targetId) break;
          const targetDef = elementDefs[targetId];
          const targetLabel = targetDef?.label ?? targetId;

          const hasTarget = neighbors.some(n => board[n] === targetId);
          if (!hasTarget) {
            violations.push({
              cellIndex: i,
              elementId,
              constraintType: 'neighbor_specific_chain',
              message: `${elementDef.label} doit être voisin d'un(e) ${targetLabel}`,
            });
          }

          const chainId = constraint.chainTargetElementId;
          if (chainId) {
            const chainPresentOnBoard = board.some(el => el === chainId);
            if (chainPresentOnBoard) {
              const hasChain = neighbors.some(n => board[n] === chainId);
              if (!hasChain) {
                const chainDef = elementDefs[chainId];
                const chainLabel = chainDef?.label ?? chainId;
                violations.push({
                  cellIndex: i,
                  elementId,
                  constraintType: 'neighbor_specific_chain',
                  message: `${elementDef.label} doit être voisin d'un(e) ${chainLabel} quand ${chainLabel} est sur le plateau`,
                });
              }
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

  // ── Passe 2 : contraintes globales (connected_group, paired_specific) ─────
  // Portent sur l'ensemble du plateau — vérifiées une fois par type d'élément.
  const checkedGlobalTypes = new Set<string>();

  for (let i = 0; i < board.length; i++) {
    const elementId = board[i];
    if (!elementId) continue;
    if (checkedGlobalTypes.has(elementId)) continue;

    const elementDef = elementDefs[elementId];
    if (!elementDef) continue;

    for (const constraint of elementDef.constraints) {

      // ── connected_group ────────────────────────────────────────────────
      // Tous les exemplaires doivent former UN SEUL groupe connexe.
      // BFS depuis le premier exemplaire : si le groupe ne contient pas
      // tous les exemplaires, il y a des sous-groupes séparés.
      // Ex : 4 chiens en 2+2 séparés → invalide.
      if (constraint.type === 'connected_group') {
        const allPositions = board.reduce<number[]>((acc, el, idx) => {
          if (el === elementId) acc.push(idx);
          return acc;
        }, []);

        if (allPositions.length > 1) {
          const group = getConnectedGroup(allPositions[0], elementId, board, boardDef);
          if (group.size !== allPositions.length) {
            for (const pos of allPositions) {
              if (!group.has(pos)) {
                violations.push({
                  cellIndex: pos,
                  elementId,
                  constraintType: 'connected_group',
                  message: `Tous les ${elementDef.label}s doivent former un seul groupe connexe`,
                });
              }
            }
          }
        }
        checkedGlobalTypes.add(elementId);
      }

      // ── paired_specific ────────────────────────────────────────────────
      // Couplage 1-pour-1 entre cet élément et targetElementId.
      // Règles :
      //   1. Counts égaux (autant de cerfs que de biches)
      //   2. Chaque exemplaire a exactement 1 voisin du type partenaire
      // Ex : 2 cerfs + 2 biches → 2 couples distincts voisins.
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

        // Règle 1 : counts égaux
        if (myPositions.length !== partnerPositions.length) {
          for (const pos of myPositions) {
            violations.push({
              cellIndex: pos,
              elementId,
              constraintType: 'paired_specific',
              message: `Le nombre de ${elementDef.label}s doit être égal au nombre de ${elementDefs[partnerId]?.label ?? partnerId}s`,
            });
          }
        } else {
          // Règle 2 : exactement 1 voisin partenaire par exemplaire
          for (const pos of myPositions) {
            const partnerNeighborCount = boardDef.connections[pos].filter(
              n => board[n] === partnerId
            ).length;
            if (partnerNeighborCount !== 1) {
              violations.push({
                cellIndex: pos,
                elementId,
                constraintType: 'paired_specific',
                message: `${elementDef.label} doit être voisin d'exactement un(e) ${elementDefs[partnerId]?.label ?? partnerId}`,
              });
            }
          }
        }
        checkedGlobalTypes.add(elementId);
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
/**
 * Vérifie si un placement individuel est valide (utilisé pendant le drag).
 * Vérifie uniquement les contraintes de voisinage avec les jetons déjà placés.
 * Les contraintes globales (connected_group, paired_specific) ne sont pas
 * vérifiables ici (plateau incomplet) — elles sont validées en fin de partie.
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
      // neighbor_specific_chain, connected_group, paired_specific :
      // non vérifiables pendant le drag (plateau incomplet).
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
