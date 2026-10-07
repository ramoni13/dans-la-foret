// Diagnostic : pourquoi niveau_6 utilise toujours la meme composition ?
import { solve } from '../src/core/engine/solver';
import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';
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
      { type: 'neighbor_specific', mode: 'forbid', scope: 'neighbor', targetElementId: 'renard' },
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
  renard: { id: 'renard', label: 'Renard', icon: ICON, color: '#FF6B35', maxPerBoard: 4,
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
  availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'cerf', 'biche', 'renard', 'ruche'],
  specialCells: { corners: [0, 8], edges: [1, 2, 3, 4], center: [5, 6, 7] },
};

const params = LEVEL_PARAMS['niveau_6'];
console.log(`Niveau_6 : ${params.compositions.length} compositions definies\n`);

params.compositions.forEach((c, idx) => {
  const total = Object.values(c).reduce((a, b) => a + (b ?? 0), 0);
  const tokens = Object.entries(c).filter(([, v]) => (v ?? 0) > 0).map(([id, count]) => ({ elementId: id, count: count! }));
  const r = solve({ boardDef: board_9_v1, fixedPlacements: [], availableTokens: tokens, elementDefs });
  const label = Object.entries(c).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => k.substring(0, 3) + v).join('+');

  // Combien de solutions passent le filtre "coins consecutifs differents" (corners=[0,8])
  const corners = [0, 8];
  const diverse = r.solutions.filter(s => s[corners[0]] !== s[corners[1]]);

  console.log(`[${idx}] total=${total} ${label.padEnd(45)} solutions=${String(r.solutionCount).padEnd(5)} diverse(coins)=${diverse.length}`);
});
