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

/**
 * BFS multi-éléments : retourne le groupe connexe contenant `startIndex`,
 * en traversant les cases occupées par l'un quelconque des elementIds donnés.
 * Utilisé pour connected_group_with (arbre + tas_buches).
 */
export function getConnectedGroupMulti(
  startIndex: number,
  elementIds: Set<string>,
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
      const el = board[neighbor];
      if (!visited.has(neighbor) && el !== null && elementIds.has(el)) {
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
            // Si la contrainte est conditionnelle (onlyIfTargetOnBoard),
            // on la skip si le target n'existe pas sur le plateau.
            if (constraint.onlyIfTargetOnBoard) {
              const targetOnBoard = board.some(el => el === targetId);
              if (!targetOnBoard) break;
            }
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

      // ── connected_group_with ───────────────────────────────────────────
      // Cet élément + groupElementId (si présent sur le plateau) forment
      // ENSEMBLE un seul groupe connexe mixte.
      // Ex : arbre + tas_buches → une seule forêt connexe.
      // Si groupElementId est absent du plateau, seuls les arbres doivent
      // être connexes entre eux (repli sur connected_group standard).
      if (constraint.type === 'connected_group_with' && !checkedGlobalTypes.has(elementId)) {
        const groupId = constraint.groupElementId;
        const groupOnBoard = groupId ? board.some(el => el === groupId) : false;

        // Rassembler toutes les positions : cet élément + l'élément associé (si présent)
        const elementIds = new Set<string>([elementId]);
        if (groupId && groupOnBoard) elementIds.add(groupId);

        const allPositions = board.reduce<number[]>((acc, el, idx) => {
          if (el !== null && elementIds.has(el)) acc.push(idx);
          return acc;
        }, []);

        if (allPositions.length > 1) {
          const group = getConnectedGroupMulti(allPositions[0], elementIds, board, boardDef);
          if (group.size !== allPositions.length) {
            for (const pos of allPositions) {
              if (!group.has(pos)) {
                const posEl = board[pos]!;
                const posLabel = elementDefs[posEl]?.label ?? posEl;
                violations.push({
                  cellIndex: pos,
                  elementId: posEl,
                  constraintType: 'connected_group_with',
                  message: groupId && groupOnBoard
                    ? `Tous les ${elementDef.label}s et ${elementDefs[groupId]?.label ?? groupId}s doivent former un seul groupe connexe`
                    : `Tous les ${posLabel}s doivent former un seul groupe connexe`,
                });
              }
            }
          }
        }
        checkedGlobalTypes.add(elementId);
        if (groupId) checkedGlobalTypes.add(groupId); // ne pas revérifier tas_buches seul
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

// ── Fonctions ONF — Mode Grille Forestière ──────────────────────────────────

/**
 * Vérifie la contrainte row_col_unique sur le plateau ONF.
 * Pour chaque ligne et chaque colonne définie dans gridMeta, s'assure
 * qu'aucun elementId n'apparaît plus d'une fois.
 *
 * Retourne les violations trouvées. Appelé en PLUS de validateBoard()
 * depuis l'écran de jeu ONF lors de la validation (bouton Valider).
 * La solution pré-calculée par solveOnf respecte déjà cette contrainte,
 * donc checkVictory() seul suffit pour la détection de victoire.
 */
export function validateRowColUnique(
  board: (string | null)[],
  gridMeta: { rows: number[][]; cols: number[][] }
): Violation[] {
  const violations: Violation[] = [];

  const checkGroup = (group: number[], groupLabel: string) => {
    const seen = new Map<string, number>(); // elementId → premier cellIndex vu
    for (const cellIdx of group) {
      const el = board[cellIdx];
      if (!el) continue;
      if (seen.has(el)) {
        // Doublon détecté dans ce groupe
        violations.push({
          cellIndex: cellIdx,
          elementId: el,
          constraintType: 'row_col_unique',
          message: `${el} apparaît plusieurs fois dans la même ${groupLabel}`,
        });
        // Marquer aussi la première occurrence si pas encore marquée
        const firstIdx = seen.get(el)!;
        if (!violations.some(v => v.cellIndex === firstIdx && v.elementId === el && v.constraintType === 'row_col_unique')) {
          violations.push({
            cellIndex: firstIdx,
            elementId: el,
            constraintType: 'row_col_unique',
            message: `${el} apparaît plusieurs fois dans la même ${groupLabel}`,
          });
        }
      } else {
        seen.set(el, cellIdx);
      }
    }
  };

  for (const row of gridMeta.rows) {
    checkGroup(row, 'ligne');
  }
  for (const col of gridMeta.cols) {
    checkGroup(col, 'colonne');
  }

  return violations;
}

/**
 * Vérifie si un placement individuel respecte la contrainte row_col_unique
 * dans le contexte ONF (utilisé pendant le drag pour le retour visuel).
 *
 * Retourne false si la ligne ou la colonne de cellIndex contient déjà elementId.
 * S'appelle après isPlacementValid() — les deux filtres s'additionnent.
 */
export function isPlacementValidOnf(
  cellIndex: number,
  elementId: string,
  currentBoard: (string | null)[],
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>
): boolean {
  // Appliquer d'abord la validation standard (règles de voisinage)
  if (!isPlacementValid(cellIndex, elementId, currentBoard, boardDef, elementDefs)) {
    return false;
  }

  // Vérifier la contrainte ligne/colonne si le plateau a des métadonnées de grille
  const gridMeta = boardDef.gridMeta;
  if (!gridMeta) return true;

  // Chercher dans quelle ligne et quelle colonne se trouve cellIndex
  for (const row of gridMeta.rows) {
    if (row.includes(cellIndex)) {
      // Vérifier qu'aucune autre case de cette ligne n'a déjà elementId
      const hasConflict = row.some(idx => idx !== cellIndex && currentBoard[idx] === elementId);
      if (hasConflict) return false;
    }
  }

  for (const col of gridMeta.cols) {
    if (col.includes(cellIndex)) {
      const hasConflict = col.some(idx => idx !== cellIndex && currentBoard[idx] === elementId);
      if (hasConflict) return false;
    }
  }

  return true;
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

  // ── Vérification des règles de placement (placementRules) ────────────
  // Rejet précoce si l'élément ne peut pas être placé sur cette case.
  // Ex : champignon → center_only → uniquement sur specialCells.center.
  if (elementDef.placementRules) {
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
      if (!allowed.includes(cellIndex)) return false;
    }
  }

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
