// Compte le nombre REEL (non plafonne a 2) de solutions par composition niveau_6
import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';
import { isPlacementValid, getConnectedGroup } from '../src/core/engine/validator';
import { LEVEL_PARAMS } from '../src/constants/difficulty';

const ICON: any = 'placeholder';

const elementDefs: Record<string, ElementDefinition> = {
  bucheron: { id: 'bucheron', label: 'Bucheron', icon: ICON, color: '#8B4513', maxPerBoard: 4,
    constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }] },
  ours: { id: 'ours', label: 'Ours', icon: ICON, color: '#6B4226', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', targetElementId: 'ruche', mode: 'require', scope: 'neighbor', minCount: 1, onlyIfTargetOnBoard: true },
    ] },
  mouton: { id: 'mouton', label: 'Mouton', icon: ICON, color: '#E8E8E8', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', mode: 'forbid', scope: 'neighbor', targetElementId: 'loup' },
    ] },
  ruche: { id: 'ruche', label: 'Ruche', icon: ICON, color: '#F5A623', maxPerBoard: 1,
    constraints: [] },
  chien: { id: 'chien', label: 'Chien', icon: ICON, color: '#D2691E', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'require', scope: 'neighbor', minCount: 1 },
      { type: 'connected_group', mode: 'require', scope: 'board' },
    ] },
  cerf: { id: 'cerf', label: 'Cerf', icon: ICON, color: '#8B6914', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'paired_specific', targetElementId: 'biche', mode: 'require', scope: 'board' },
    ] },
  biche: { id: 'biche', label: 'Biche', icon: ICON, color: '#C8A96E', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'paired_specific', targetElementId: 'cerf', mode: 'require', scope: 'board' },
    ] },
  Loup: { id: 'loup', label: 'loup', icon: ICON, color: '#FF6B35', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', mode: 'forbid', scope: 'neighbor', targetElementId: 'mouton' },
    ] },
};

const board_9_v1: BoardDefinition = {
  id: 'board_9_v1', label: 'Lisiere Etendue', cellCount: 9,
  connections: [
    [1, 2, 5], [0, 3], [0, 4], [1, 5, 6], [2, 5, 7],
    [0, 3, 4, 6, 7], [3, 5, 8], [4, 5, 8], [6, 7],
  ],
  cellPositions: [],
  backgroundAsset: null as any,
  availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'cerf', 'biche', 'loup', 'ruche'],
  specialCells: { corners: [0, 8], edges: [1, 2, 3, 4], center: [5, 6, 7] },
};

function isCompleteSolutionValid(board: string[]): boolean {
  for (let i = 0; i < board.length; i++) {
    const elementId = board[i];
    const elementDef = elementDefs[elementId];
    if (!elementDef) continue;
    const neighbors = board_9_v1.connections[i];
    for (const constraint of elementDef.constraints) {
      if (constraint.scope !== 'neighbor') continue;
      if (constraint.type === 'neighbor_same') {
        if (constraint.mode === 'forbid') {
          if (neighbors.some(n => board[n] === elementId)) return false;
        } else if (constraint.mode === 'require') {
          const minCount = constraint.minCount ?? 1;
          if (neighbors.filter(n => board[n] === elementId).length < minCount) return false;
        }
      }
      if (constraint.type === 'neighbor_specific') {
        const targetId = constraint.targetElementId!;
        if (constraint.mode === 'forbid') {
          if (neighbors.some(n => board[n] === targetId)) return false;
        } else if (constraint.mode === 'require') {
          const minCount = constraint.minCount ?? 1;
          if (neighbors.filter(n => board[n] === targetId).length < minCount) return false;
        }
      }
    }
  }
  const checkedGlobalTypes = new Set<string>();
  for (let i = 0; i < board.length; i++) {
    const elementId = board[i];
    if (checkedGlobalTypes.has(elementId)) continue;
    const elementDef = elementDefs[elementId];
    if (!elementDef) continue;
    for (const constraint of elementDef.constraints) {
      if (constraint.type === 'connected_group') {
        const allPositions = board.reduce<number[]>((acc, el, idx) => { if (el === elementId) acc.push(idx); return acc; }, []);
        if (allPositions.length > 1) {
          const group = getConnectedGroup(allPositions[0], elementId, board, board_9_v1);
          if (group.size !== allPositions.length) return false;
        }
        checkedGlobalTypes.add(elementId);
      }
      if (constraint.type === 'paired_specific') {
        const partnerId = constraint.targetElementId!;
        const myPositions = board.reduce<number[]>((acc, el, idx) => { if (el === elementId) acc.push(idx); return acc; }, []);
        const partnerPositions = board.reduce<number[]>((acc, el, idx) => { if (el === partnerId) acc.push(idx); return acc; }, []);
        if (myPositions.length !== partnerPositions.length) return false;
        for (const pos of myPositions) {
          const cnt = board_9_v1.connections[pos].filter(n => board[n] === partnerId).length;
          if (cnt !== 1) return false;
        }
        checkedGlobalTypes.add(elementId);
      }
    }
  }
  return true;
}

function countAllSolutions(availableTokens: { elementId: string; count: number }[]): number {
  const inventory: Record<string, number> = {};
  for (const t of availableTokens) inventory[t.elementId] = t.count;
  const board: (string | null)[] = Array(9).fill(null);
  let count = 0;

  function backtrack() {
    const emptyIdx = board.findIndex(c => c === null);
    if (emptyIdx === -1) {
      if (isCompleteSolutionValid(board as string[])) count++;
      return;
    }
    for (const elementId of Object.keys(inventory)) {
      if (inventory[elementId] <= 0) continue;
      if (!isPlacementValid(emptyIdx, elementId, board, board_9_v1, elementDefs)) continue;
      board[emptyIdx] = elementId;
      inventory[elementId]--;
      backtrack();
      board[emptyIdx] = null;
      inventory[elementId]++;
    }
  }
  backtrack();
  return count;
}

const params = LEVEL_PARAMS['niveau_6'];
console.log(`Niveau_6 : comptage EXACT (sans plafond) des solutions par composition\n`);
params.compositions.forEach((c, idx) => {
  const tokens = Object.entries(c).filter(([, v]) => (v ?? 0) > 0).map(([id, count]) => ({ elementId: id, count: count! }));
  const label = Object.entries(c).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => k.substring(0, 3) + v).join('+');
  const total = countAllSolutions(tokens);
  console.log(`[${idx}] ${label.padEnd(45)} solutions REELLES = ${total}`);
});
