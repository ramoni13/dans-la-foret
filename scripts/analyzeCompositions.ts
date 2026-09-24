// Script d'analyse des compositions pour le niveau_2
import { solve } from '../src/core/engine/solver';
import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';

const ICON: any = 'placeholder';

const elementDefs: Record<string, ElementDefinition> = {
  bucheron: { id: 'bucheron', label: 'Bucheron', icon: ICON, color: '#8B4513', maxPerBoard: 4, constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }] },
  ours: { id: 'ours', label: 'Ours', icon: ICON, color: '#6B4226', maxPerBoard: 4, constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }] },
  mouton: { id: 'mouton', label: 'Mouton', icon: ICON, color: '#E8E8E8', maxPerBoard: 4, constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }, { type: 'neighbor_specific', mode: 'forbid', scope: 'neighbor', targetElementId: 'renard' }] },
  chien: { id: 'chien', label: 'Chien', icon: ICON, color: '#D2691E', maxPerBoard: 4, constraints: [{ type: 'neighbor_same', mode: 'require', scope: 'neighbor', minCount: 1 }] },
};

const board: BoardDefinition = {
  id: 'board_6_v1', label: 'Clairiere', cellCount: 6,
  connections: [[1, 3], [0, 2, 4, 5], [1, 3, 4], [0, 2, 4, 5], [1, 2, 3], [1, 3]],
  cellPositions: [{ x: 43, y: 8 }, { x: 19, y: 42 }, { x: 43, y: 29 }, { x: 67, y: 42 }, { x: 43, y: 56 }, { x: 43, y: 78 }],
  backgroundAsset: null as any,
  availableElements: ['bucheron', 'ours', 'mouton', 'chien'],
};

// Toutes les compositions à tester (total = 6)
const compos: Record<string, number>[] = [
  // Avec chien
  { bucheron: 2, ours: 1, mouton: 1, chien: 2 },
  { bucheron: 1, ours: 2, mouton: 1, chien: 2 },
  { bucheron: 1, ours: 1, mouton: 2, chien: 2 },
  { bucheron: 2, ours: 2, mouton: 0, chien: 2 },
  { bucheron: 0, ours: 2, mouton: 2, chien: 2 },
  { bucheron: 2, ours: 0, mouton: 2, chien: 2 },
  { bucheron: 4, ours: 0, mouton: 0, chien: 2 },
  { bucheron: 0, ours: 4, mouton: 0, chien: 2 },
  { bucheron: 0, ours: 0, mouton: 4, chien: 2 },
  { bucheron: 3, ours: 1, mouton: 0, chien: 2 },
  { bucheron: 1, ours: 3, mouton: 0, chien: 2 },
  { bucheron: 3, ours: 0, mouton: 1, chien: 2 },
  { bucheron: 0, ours: 3, mouton: 1, chien: 2 },
  { bucheron: 1, ours: 0, mouton: 3, chien: 2 },
  { bucheron: 0, ours: 1, mouton: 3, chien: 2 },
  // Avec chien=4 (meute forte)
  { bucheron: 1, ours: 1, mouton: 0, chien: 4 },
  { bucheron: 1, ours: 0, mouton: 1, chien: 4 },
  { bucheron: 0, ours: 1, mouton: 1, chien: 4 },
  { bucheron: 2, ours: 0, mouton: 0, chien: 4 },
  { bucheron: 0, ours: 2, mouton: 0, chien: 4 },
  { bucheron: 0, ours: 0, mouton: 2, chien: 4 },
  // Sans chien (pour comparaison)
  { bucheron: 2, ours: 2, mouton: 2 },
  { bucheron: 3, ours: 2, mouton: 1 },
  { bucheron: 4, ours: 1, mouton: 1 },
];

console.log('Analyse des compositions pour board_6_v1 (6 cases)\n');
console.log('Composition                    | Solutions | Tension chien possible');
console.log('-------------------------------|-----------|----------------------');

compos.forEach(c => {
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  if (total !== 6) return;

  const tokens = Object.entries(c).filter(([, v]) => v > 0).map(([id, count]) => ({ elementId: id, count }));
  const r = solve({ boardDef: board, fixedPlacements: [], availableTokens: tokens, elementDefs });

  const label = Object.entries(c).filter(([, v]) => v > 0).map(([k, v]) => k.substring(0, 3) + v).join('+');
  const chienCount = c['chien'] ?? 0;
  // La tension chien/meute est possible si chien >= 2 ET au moins 1 chien peut être fixe
  // avec au moins 1 autre chien à poser
  const tensionPossible = chienCount >= 2 ? 'OUI (chien fixe + chien à poser)' : 'NON (pas de chien)';

  console.log(label.padEnd(30) + ' | ' + String(r.solutionCount).padEnd(9) + ' | ' + tensionPossible);
});
