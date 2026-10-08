// ============================================================
// TEST D'UNICITÉ DU DÉFI DU JOUR 2026-10-06
// Vérifie que le solver trouve bien exactement 1 solution.
// ============================================================

import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';
import { FixedPlacement, TokenCount } from '../src/core/models/Challenge';
import { solve } from '../src/core/engine/solver';

const ICON: any = 'placeholder';

const elementDefs: Record<string, ElementDefinition> = {
  bucheron: {
    id: 'bucheron', label: 'Bucheron', icon: ICON, color: '#8B4513', maxPerBoard: 4,
    constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }],
  },
  ours: {
    id: 'ours', label: 'Ours', icon: ICON, color: '#6B4226', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', targetElementId: 'ruche', mode: 'require', scope: 'neighbor', minCount: 1, onlyIfTargetOnBoard: true },
    ],
  },
  mouton: {
    id: 'mouton', label: 'Mouton', icon: ICON, color: '#E8E8E8', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', mode: 'forbid', scope: 'neighbor', targetElementId: 'loup' },
    ],
  },
  ruche: {
    id: 'ruche', label: 'Ruche', icon: ICON, color: '#F5A623', maxPerBoard: 1,
    constraints: [],
  },
  chien: {
    id: 'chien', label: 'Chien', icon: ICON, color: '#D2691E', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'require', scope: 'neighbor', minCount: 1 },
      { type: 'connected_group', mode: 'require', scope: 'board' },
    ],
  },
  cerf: {
    id: 'cerf', label: 'Cerf', icon: ICON, color: '#8B6914', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'paired_specific', targetElementId: 'biche', mode: 'require', scope: 'board' },
    ],
  },
  biche: {
    id: 'biche', label: 'Biche', icon: ICON, color: '#C8A96E', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'paired_specific', targetElementId: 'cerf', mode: 'require', scope: 'board' },
    ],
  },
  Loup: {
    id: 'loup', label: 'loup', icon: ICON, color: '#FF6B35', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', mode: 'forbid', scope: 'neighbor', targetElementId: 'mouton' },
    ],
  },
  tas_buches: {
    id: 'tas_buches', label: 'Bûches', icon: ICON, color: '#6D4C2A', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_specific_chain', targetElementId: 'bucheron', chainTargetElementId: 'chalet', mode: 'require', scope: 'neighbor' },
    ],
  },
  chalet: {
    id: 'chalet', label: 'Chalet', icon: ICON, color: '#A0522D', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', mode: 'require', scope: 'neighbor', targetElementId: 'bucheron', minCount: 1 },
    ],
  },
  champignon: {
    id: 'champignon', label: 'Champignon', icon: ICON, color: '#8B6914', maxPerBoard: 3,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
    ],
    placementRules: [
      { type: 'center_only' },
    ],
  },
};

const board15cellsDaily: BoardDefinition = {
  id: 'board_15_daily', label: 'Clairière Secrète', cellCount: 15,
  connections: [
    [1, 3, 5],           // case 0
    [0, 2, 7],           // case 1
    [1, 4, 6],           // case 2
    [0, 5, 7, 10],       // case 3  (centre)
    [2, 6, 7, 11],       // case 4  (centre)
    [0, 3, 8],           // case 5
    [2, 4, 9],           // case 6
    [1, 3, 4, 10, 11, 13], // case 7  (centre, hub)
    [5, 10, 12],         // case 8
    [6, 11, 14],         // case 9
    [3, 7, 8, 12],       // case 10 (centre)
    [4, 7, 9, 14],       // case 11 (centre)
    [8, 10, 13],         // case 12
    [7, 12, 14],         // case 13
    [9, 11, 13],         // case 14
  ],
  cellPositions: [
    { x: 12, y: 5 }, { x: 50, y: 5 }, { x: 88, y: 5 },
    { x: 30, y: 28 }, { x: 70, y: 28 }, { x: 8, y: 30 },
    { x: 92, y: 30 }, { x: 50, y: 38 }, { x: 8, y: 62 },
    { x: 92, y: 62 }, { x: 30, y: 62 }, { x: 70, y: 62 },
    { x: 12, y: 90 }, { x: 50, y: 90 }, { x: 88, y: 90 },
  ],
  backgroundAsset: null as any,
  availableElements: [
    'bucheron', 'ours', 'mouton', 'chien', 'chalet', 'loup',
    'ruche', 'cerf', 'biche', 'tas_buches', 'champignon',
  ],
  specialCells: {
    corners: [0, 2, 12, 14],
    center: [3, 4, 7, 10, 11],
    edges: [1, 5, 6, 8, 9, 13],
  },
};

// ── Défi du jour 2026-10-06 ────────────────────────────────────

const solution = [
  'bucheron',    // 0
  'mouton',      // 1
  'chien',       // 2
  'champignon',  // 3
  'mouton',      // 4
  'loup',      // 5
  'chien',       // 6
  'ours',        // 7
  'biche',       // 8
  'mouton',      // 9
  'loup',      // 10
  'champignon',  // 11
  'cerf',        // 12
  'mouton',      // 13
  'bucheron',    // 14
];

// Cases fixes (niv 10+)
const fixedPlacements: FixedPlacement[] = [
  { cellIndex: 5, elementId: 'loup' },
  { cellIndex: 7, elementId: 'ours' },
  { cellIndex: 10, elementId: 'loup' },
  { cellIndex: 11, elementId: 'champignon' },
  { cellIndex: 12, elementId: 'cerf' },
];

// Jetons disponibles (niv 10+)
const availableTokens: TokenCount[] = [
  { elementId: 'bucheron', count: 2 },
  { elementId: 'mouton', count: 4 },
  { elementId: 'chien', count: 2 },
  { elementId: 'biche', count: 1 },
  { elementId: 'champignon', count: 1 },
];

console.log('=== TEST UNICITÉ DÉFI DU JOUR 2026-10-06 ===\n');

// 1. Vérifier avec le solver (pas de seed, exploration exhaustive)
console.log('1. Solver exhaustif (pas de seed) :');
const result = solve({
  boardDef: board15cellsDaily,
  fixedPlacements,
  availableTokens,
  elementDefs,
});
console.log(`   Solutions trouvées : ${result.solutionCount}`);
console.log(`   isUnique : ${result.isUnique}`);
if (result.solutionCount > 1) {
  console.log('\n   ⚠ MULTIPLE SOLUTIONS TROUVÉES :');
  result.solutions.forEach((sol, i) => {
    console.log(`\n   Solution ${i + 1}:`);
    sol.forEach((el, idx) => {
      const fixed = fixedPlacements.find(fp => fp.cellIndex === idx);
      const marker = fixed ? ' (FIXE)' : '';
      const diff = solution[idx] !== el ? ' ← DIFFÉRENT' : '';
      console.log(`     Case ${idx.toString().padStart(2)}: ${el.padEnd(12)}${marker}${diff}`);
    });
  });
}

// 2. Vérifier manuellement l'échange bucheron(0) ↔ mouton(1)
console.log('\n2. Vérification manuelle : échange bucheron(0) ↔ mouton(1)');
const swapped = [...solution];
swapped[0] = 'mouton';
swapped[1] = 'bucheron';

// Vérifier contraintes pour case 0 = mouton
const case0Neighbors = board15cellsDaily.connections[0]; // [1, 3, 5]
const case0NeighborElements = case0Neighbors.map(n => swapped[n]);
console.log(`   Case 0 (mouton) : voisins = ${case0Neighbors.map(n => `${n}:${swapped[n]}`).join(', ')}`);
const moutonForbidsLoup = case0NeighborElements.includes('loup');
console.log(`   Mouton interdit voisin Loup ? ${moutonForbidsLoup ? '⚠ OUI → Loup en case 5 → INVALIDE' : 'Non → OK'}`);

// Vérifier contraintes pour case 1 = bucheron
const case1Neighbors = board15cellsDaily.connections[1]; // [0, 2, 7]
const case1NeighborElements = case1Neighbors.map(n => swapped[n]);
console.log(`   Case 1 (bucheron) : voisins = ${case1Neighbors.map(n => `${n}:${swapped[n]}`).join(', ')}`);
const bucheronForbidsBucheron = case1NeighborElements.includes('bucheron');
console.log(`   Bucheron interdit voisin bucheron ? ${bucheronForbidsBucheron ? '⚠ OUI → INVALIDE' : 'Non → OK'}`);

console.log(`\n   → Échange valid ? ${!moutonForbidsLoup && !bucheronForbidsBucheron ? '✓ OUI (BUG!)' : '✗ NON (OK — pas un doublon)'}`);

// 3. Tester d'autres échanges possibles entre éléments non-fixes
console.log('\n3. Recherche systématique d\'échanges valides...');
const nonFixedCells = Array.from({ length: 15 }, (_, i) => i)
  .filter(i => !fixedPlacements.some(fp => fp.cellIndex === i));

let swapCount = 0;
for (let a = 0; a < nonFixedCells.length; a++) {
  for (let b = a + 1; b < nonFixedCells.length; b++) {
    const ci = nonFixedCells[a];
    const cj = nonFixedCells[b];
    if (solution[ci] === solution[cj]) continue; // Same element, skip

    const testSol = [...solution];
    testSol[ci] = solution[cj];
    testSol[cj] = solution[ci];

    // Quick constraint check for the two swapped cells + their neighbors
    const checkResult = solve({
      boardDef: board15cellsDaily,
      fixedPlacements: [
        ...fixedPlacements,
        // Fix ALL cells except ci and cj
        ...nonFixedCells.filter(c => c !== ci && c !== cj).map(c => ({
          cellIndex: c,
          elementId: solution[c],
        })),
      ],
      availableTokens: [
        { elementId: solution[ci], count: 1 },
        { elementId: solution[cj], count: 1 },
      ],
      elementDefs,
    });

    if (checkResult.solutionCount > 1) {
      swapCount++;
      console.log(`   ⚠ Échange cases ${ci}↔${cj} (${solution[ci]}↔${solution[cj]}) → ${checkResult.solutionCount} solutions`);
    }
  }
}
if (swapCount === 0) {
  console.log('   ✓ Aucun échange simple ne produit de doublon');
}

console.log('\n=== FIN DU TEST ===');
