// ============================================================
// TEST DU GENERATEUR DE DEFIS JOURNALIERS
// Vérifie que generateDailyChallenge :
//   - Produit un défi pour chaque jour testé
//   - Atteint ≥ 9 cases vides (baseFixedCount ≤ 6)
//   - Respecte les règles pédagogiques et narratives
//   - L'unicité est garantie à chaque niveau d'adaptation
//
// Exécution : npx ts-node --project tsconfig.scripts.json scripts/testDailyGenerator.ts
// ============================================================

import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';
import { TokenCount } from '../src/core/models/Challenge';
import { Composition } from '../src/constants/difficulty';
import { solve, RngFunction } from '../src/core/engine/solver';

// ── Éléments SANS require() d'assets ────────────────────────────────────────
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
      { type: 'neighbor_specific', mode: 'forbid', scope: 'neighbor', targetElementId: 'renard' },
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
  renard: {
    id: 'renard', label: 'Renard', icon: ICON, color: '#FF6B35', maxPerBoard: 4,
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

// ── Board 15 cases daily SANS require() d'assets ────────────────────────────
const board15cellsDaily: BoardDefinition = {
  id: 'board_15_daily',
  label: 'Clairière Secrète',
  cellCount: 15,
  connections: [
    [1, 3, 5],           // case 0
    [0, 2, 7],           // case 1
    [1, 4, 6],           // case 2
    [0, 5, 7, 10],       // case 3
    [2, 6, 7, 11],       // case 4
    [0, 3, 8],           // case 5
    [2, 4, 9],           // case 6
    [1, 3, 4, 10, 11, 13], // case 7 (hub)
    [5, 10, 12],         // case 8
    [6, 11, 14],         // case 9
    [3, 7, 8, 12],       // case 10
    [4, 7, 9, 14],       // case 11
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
    'bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard',
    'ruche', 'cerf', 'biche', 'tas_buches', 'champignon',
  ],
  specialCells: {
    corners: [0, 2, 12, 14],
    center: [3, 4, 7, 10, 11],
    edges: [1, 5, 6, 8, 9, 13],
  },
};

// ── Reproduction des fonctions du dailyChallengeService (sans Firebase) ──────

function mulberry32(seed: number): RngFunction {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(date: Date): number {
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

function seededShuffle<T>(arr: T[], rng: RngFunction): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── Compositions (copie exacte de dailyChallengeService.ts) ─────────────────
const DAILY_COMPOSITIONS: Composition[] = [
  { bucheron: 3, ours: 2, mouton: 3, chien: 2, renard: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 4, ours: 2, mouton: 2, chien: 2, renard: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 2, ours: 2, mouton: 4, chien: 2, renard: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 2, ours: 2, mouton: 2, chien: 3, renard: 1, cerf: 1, biche: 1, ruche: 1, champignon: 2 },
  { bucheron: 3, ours: 2, mouton: 2, chien: 2, ruche: 1, renard: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 2, ours: 2, mouton: 3, chien: 2, ruche: 1, renard: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 3, ours: 2, mouton: 2, chien: 2, chalet: 1, renard: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 3, ours: 1, mouton: 2, chien: 3, chalet: 1, renard: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 3, ours: 2, mouton: 2, chien: 3, tas_buches: 1, renard: 1, cerf: 1, biche: 1, champignon: 1 },
  { bucheron: 3, ours: 1, mouton: 3, chien: 2, tas_buches: 1, renard: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 3, ours: 2, mouton: 1, chien: 2, chalet: 1, renard: 1, cerf: 1, biche: 1, tas_buches: 1, champignon: 2 },
  { bucheron: 3, ours: 2, mouton: 1, chien: 2, chalet: 1, renard: 1, cerf: 1, biche: 1, tas_buches: 1, ruche: 1, champignon: 1 },
  { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 1, cerf: 2, biche: 2, champignon: 2 },
  { bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 1, cerf: 3, biche: 3, champignon: 1 },
  { bucheron: 2, ours: 2, mouton: 3, chien: 2, renard: 2, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 2, ours: 1, mouton: 4, chien: 2, renard: 2, cerf: 1, biche: 1, champignon: 2 },
];

// ── Constantes ──────────────────────────────────────────────────────────────
const TARGET_MAX_FIXED = 6;
const ATTEMPTS_PER_COMPOSITION = 5;
const MIN_FIXED_COUNT = 4;
const MAX_FIXED_COUNT = 9;

// ── Fonctions pédagogiques / narratives (copie exacte) ──────────────────────

function isDailyPedagogicallyValid(availableTokens: TokenCount[], fullTokens: TokenCount[]): boolean {
  const availableMap = new Map(availableTokens.map(t => [t.elementId, t.count]));
  const fullMap = new Map(fullTokens.map(t => [t.elementId, t.count]));
  const inFull = (id: string) => (fullMap.get(id) ?? 0) > 0;
  const hasAvailable = (id: string) => (availableMap.get(id) ?? 0) > 0;
  if (availableTokens.length === 0 || availableTokens.every(t => t.count === 0)) return false;
  if (inFull('chalet') && !hasAvailable('chalet') && !hasAvailable('bucheron')) return false;
  if (inFull('renard') && !hasAvailable('renard') && !hasAvailable('mouton')) return false;
  if (inFull('ruche') && !hasAvailable('ruche') && !hasAvailable('ours')) return false;
  if (inFull('cerf') && !hasAvailable('cerf') && !hasAvailable('biche')) return false;
  if (inFull('biche') && !hasAvailable('biche') && !hasAvailable('cerf')) return false;
  if (inFull('tas_buches') && !hasAvailable('tas_buches') && !hasAvailable('bucheron')) return false;
  if (inFull('chien') && !hasAvailable('chien')) return false;
  if (inFull('champignon') && !hasAvailable('champignon')) return false;
  return true;
}

function isDailyNarrativelyCoherent(tokenCounts: TokenCount[]): boolean {
  const inCompo = (id: string) => tokenCounts.some(t => t.elementId === id && t.count > 0);
  if (inCompo('renard') && !inCompo('mouton')) return false;
  if (inCompo('chalet') && !inCompo('bucheron')) return false;
  if (inCompo('tas_buches') && !inCompo('bucheron')) return false;
  return true;
}

function isDailyNarrativelyInteresting(availableTokens: TokenCount[], fullTokenCounts: TokenCount[]): boolean {
  const inCompo = (id: string) => fullTokenCounts.some(t => t.elementId === id && t.count > 0);
  const hasAvailable = (id: string) => availableTokens.some(t => t.elementId === id && t.count > 0);
  if (inCompo('renard') && inCompo('mouton')) {
    if (!hasAvailable('renard') && !hasAvailable('mouton')) return false;
  }
  if (inCompo('chalet') && inCompo('bucheron')) {
    if (!hasAvailable('chalet') && !hasAvailable('bucheron')) return false;
  }
  if (inCompo('tas_buches') && inCompo('bucheron')) {
    if (!hasAvailable('tas_buches') && !hasAvailable('bucheron')) return false;
  }
  return true;
}

function getDailyRemovalStrategy(strategyIndex: number, boardDef: BoardDefinition, rng: RngFunction): number[] {
  const allIndices = [...Array(boardDef.cellCount).keys()];
  const byConnectivity = [...allIndices].sort(
    (a, b) => boardDef.connections[a].length - boardDef.connections[b].length
  );
  const edgesFirst = byConnectivity;
  const centerFirst = [...byConnectivity].reverse();
  const alternated: number[] = [];
  for (let i = 0; i < allIndices.length; i++) {
    if (i % 2 === 0) alternated.push(edgesFirst[Math.floor(i / 2)]);
    else alternated.push(centerFirst[Math.floor(i / 2)]);
  }
  const shuffleWithinGroups = (sorted: number[]): number[] => {
    const result: number[] = [];
    let groupStart = 0;
    for (let i = 1; i <= sorted.length; i++) {
      if (i === sorted.length ||
          boardDef.connections[sorted[i]].length !== boardDef.connections[sorted[i - 1]].length) {
        result.push(...seededShuffle(sorted.slice(groupStart, i), rng));
        groupStart = i;
      }
    }
    return result;
  };
  switch (strategyIndex % 4) {
    case 0: return seededShuffle(allIndices, rng);
    case 1: return shuffleWithinGroups(edgesFirst);
    case 2: return shuffleWithinGroups(centerFirst);
    case 3: return alternated;
    default: return seededShuffle(allIndices, rng);
  }
}

function computeDailyAvailableTokens(
  solution: string[],
  fixedPlacements: { cellIndex: number; elementId: string }[],
  fullTokens: TokenCount[]
): TokenCount[] {
  const fixedCounts: Record<string, number> = {};
  for (const fp of fixedPlacements) {
    fixedCounts[fp.elementId] = (fixedCounts[fp.elementId] ?? 0) + 1;
  }
  return fullTokens
    .map(t => ({ elementId: t.elementId, count: t.count - (fixedCounts[t.elementId] ?? 0) }))
    .filter(t => t.count > 0);
}

// ── Générateur (logique identique à dailyChallengeService.ts) ───────────────

interface TestResult {
  date: string;
  success: boolean;
  compositionIndex: number;
  fixedCount: number;
  emptyCells: number;
  timeMs: number;
  availableElements: string[];
  pedagogicallyValid: boolean;
  narrativelyInteresting: boolean;
}

function testGenerateDaily(date: Date): TestResult {
  const startTime = Date.now();
  const seed = dateSeed(date);
  const rng = mulberry32(seed);
  const boardDef = board15cellsDaily;

  const compositionOrder = seededShuffle(
    DAILY_COMPOSITIONS.map((_, i) => i),
    rng
  );

  let dbgNoSolution = 0;
  let dbgNotCoherent = 0;
  let dbgNotEnoughEmpty = 0;
  let dbgNotPedago = 0;
  let dbgNotNarrative = 0;

  for (const compIndex of compositionOrder) {
    const composition = DAILY_COMPOSITIONS[compIndex];
    const fullTokens: TokenCount[] = [];
    for (const [elementId, count] of Object.entries(composition)) {
      if ((count as number) > 0) {
        fullTokens.push({ elementId, count: count as number });
      }
    }

    const totalTokens = fullTokens.reduce((acc, t) => acc + t.count, 0);
    if (totalTokens !== boardDef.cellCount) continue;

    if (!isDailyNarrativelyCoherent(fullTokens)) {
      dbgNotCoherent++;
      continue;
    }

    for (let attempt = 0; attempt < ATTEMPTS_PER_COMPOSITION; attempt++) {
      const attemptSeed = seed + compIndex * 7919 + attempt * 13;
      const attemptRng = mulberry32(attemptSeed);

      const solverResult = solve({
        boardDef,
        fixedPlacements: [],
        availableTokens: fullTokens,
        elementDefs,
        rng: attemptRng,
      });

      if (solverResult.solutionCount === 0) {
        dbgNoSolution++;
        continue;
      }

      const solution = solverResult.solutions[0];

      const strategyRng = mulberry32(attemptSeed + 31);
      const removalOrder = getDailyRemovalStrategy(attempt, boardDef, strategyRng);

      let fixedPlacements = solution.map((elementId: string, cellIndex: number) => ({
        cellIndex,
        elementId,
      }));

      let emptyCellCount = 0;
      const removedOrder: number[] = [];

      for (const idx of removalOrder) {
        const newFixed = fixedPlacements.filter((fp: any) => fp.cellIndex !== idx);
        const available = computeDailyAvailableTokens(solution, newFixed, fullTokens);

        const checkRng = mulberry32(attemptSeed + idx * 37);
        const checkResult = solve({
          boardDef,
          fixedPlacements: newFixed,
          availableTokens: available,
          elementDefs,
          rng: checkRng,
        });

        if (checkResult.isUnique) {
          fixedPlacements = newFixed;
          emptyCellCount++;
          removedOrder.push(idx);
        }
      }

      const actualFixedCount = boardDef.cellCount - emptyCellCount;
      if (actualFixedCount > TARGET_MAX_FIXED) {
        dbgNotEnoughEmpty++;
        continue;
      }

      const availableTokens = computeDailyAvailableTokens(solution, fixedPlacements, fullTokens);
      const pedago = isDailyPedagogicallyValid(availableTokens, fullTokens);
      const narrative = isDailyNarrativelyInteresting(availableTokens, fullTokens);

      if (!pedago) { dbgNotPedago++; continue; }
      if (!narrative) { dbgNotNarrative++; continue; }

      // Vérifier l'unicité finale
      const finalCheck = solve({
        boardDef,
        fixedPlacements,
        availableTokens,
        elementDefs,
      });

      const dateStr = date.toISOString().split('T')[0];

      return {
        date: dateStr,
        success: true,
        compositionIndex: compIndex,
        fixedCount: actualFixedCount,
        emptyCells: emptyCellCount,
        timeMs: Date.now() - startTime,
        availableElements: availableTokens.map(t => `${t.elementId}×${t.count}`),
        pedagogicallyValid: pedago,
        narrativelyInteresting: narrative,
      };
    }
  }

  return {
    date: date.toISOString().split('T')[0],
    success: false,
    compositionIndex: -1,
    fixedCount: -1,
    emptyCells: -1,
    timeMs: Date.now() - startTime,
    availableElements: [],
    pedagogicallyValid: false,
    narrativelyInteresting: false,
  };
}

// ── Exécution ───────────────────────────────────────────────────────────────

console.log('=== TEST GÉNÉRATEUR DÉFI JOURNALIER ===\n');

// Tester 30 jours consécutifs
const DAYS_TO_TEST = 30;
const startDate = new Date('2026-10-01T00:00:00Z');

let successCount = 0;
let failCount = 0;
let totalTimeMs = 0;
const fixedCounts: number[] = [];
const compositionUsage = new Map<number, number>();

for (let day = 0; day < DAYS_TO_TEST; day++) {
  const testDate = new Date(startDate.getTime() + day * 86400000);
  const result = testGenerateDaily(testDate);

  totalTimeMs += result.timeMs;

  if (result.success) {
    successCount++;
    fixedCounts.push(result.fixedCount);
    compositionUsage.set(
      result.compositionIndex,
      (compositionUsage.get(result.compositionIndex) ?? 0) + 1
    );

    const status = result.fixedCount <= TARGET_MAX_FIXED ? '✓' : '⚠';
    console.log(
      `${status} ${result.date} | compo #${String(result.compositionIndex).padStart(2)} | ` +
      `${result.fixedCount} fixes / ${result.emptyCells} vides | ` +
      `${result.timeMs}ms | ` +
      `à poser: ${result.availableElements.join(', ')}`
    );
  } else {
    failCount++;
    console.log(`✗ ${result.date} | ÉCHEC (${result.timeMs}ms)`);
  }
}

console.log('\n=== RÉSUMÉ ===');
console.log(`Jours testés : ${DAYS_TO_TEST}`);
console.log(`Succès : ${successCount} / ${DAYS_TO_TEST}`);
console.log(`Échecs : ${failCount}`);
console.log(`Temps total : ${totalTimeMs}ms (moy. ${Math.round(totalTimeMs / DAYS_TO_TEST)}ms/jour)`);

if (fixedCounts.length > 0) {
  const avgFixed = fixedCounts.reduce((a, b) => a + b, 0) / fixedCounts.length;
  const minFixed = Math.min(...fixedCounts);
  const maxFixed = Math.max(...fixedCounts);
  console.log(`Cases fixes : min=${minFixed} max=${maxFixed} moy=${avgFixed.toFixed(1)}`);
  console.log(`Cases vides : min=${15 - maxFixed} max=${15 - minFixed} moy=${(15 - avgFixed).toFixed(1)}`);
}

console.log('\nUtilisation des compositions :');
const sortedUsage = [...compositionUsage.entries()].sort((a, b) => b[1] - a[1]);
for (const [idx, count] of sortedUsage) {
  console.log(`  Compo #${String(idx).padStart(2)} : ${count} fois`);
}

const unusedCompositions = DAILY_COMPOSITIONS
  .map((_, i) => i)
  .filter(i => !compositionUsage.has(i));
if (unusedCompositions.length > 0) {
  console.log(`  Non utilisées (${unusedCompositions.length}) : #${unusedCompositions.join(', #')}`);
}

// Verdict final
console.log('\n=== VERDICT ===');
if (failCount === 0 && fixedCounts.every(f => f <= TARGET_MAX_FIXED)) {
  console.log('✓ TOUS LES TESTS PASSENT — Chaque jour a ≥ 9 cases vides');
} else if (failCount > 0) {
  console.log(`✗ ${failCount} JOUR(S) EN ÉCHEC — Le générateur ne trouve pas de solution`);
} else {
  const tooMany = fixedCounts.filter(f => f > TARGET_MAX_FIXED).length;
  console.log(`⚠ ${tooMany} JOUR(S) avec > ${TARGET_MAX_FIXED} cases fixes (< 9 vides)`);
}
