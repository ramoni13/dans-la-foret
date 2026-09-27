// Mesure le taux de succes reel (fixedPlacements -> solution unique) par composition
import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';
import { solve } from '../src/core/engine/solver';
import { LEVEL_PARAMS, Composition } from '../src/constants/difficulty';
import { FixedPlacement, TokenCount } from '../src/core/models/Challenge';

const ICON: any = 'placeholder';

const elementDefs: Record<string, ElementDefinition> = {
  bucheron: { id: 'bucheron', label: 'Bucheron', icon: ICON, color: '#8B4513', maxPerBoard: 4,
    constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }] },
  ours: { id: 'ours', label: 'Ours', icon: ICON, color: '#6B4226', maxPerBoard: 4,
    constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }] },
  mouton: { id: 'mouton', label: 'Mouton', icon: ICON, color: '#E8E8E8', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', mode: 'forbid', scope: 'neighbor', targetElementId: 'renard' },
    ] },
  ruche: { id: 'ruche', label: 'Ruche', icon: ICON, color: '#F5A623', maxPerBoard: 1,
    constraints: [
      { type: 'neighbor_specific', targetElementId: 'ours', mode: 'require', scope: 'neighbor', minCount: 1 },
    ] },
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

function compositionToTokens(composition: Composition): TokenCount[] {
  return Object.entries(composition).filter(([, c]) => (c ?? 0) > 0).map(([id, c]) => ({ elementId: id, count: c! }));
}
function computeAvailable(composition: Composition, fixedPlacements: FixedPlacement[]): TokenCount[] {
  const remaining: Record<string, number> = {};
  for (const [id, c] of Object.entries(composition)) if ((c ?? 0) > 0) remaining[id] = c!;
  for (const fp of fixedPlacements) if (remaining[fp.elementId] !== undefined) remaining[fp.elementId]--;
  return Object.entries(remaining).filter(([, c]) => c > 0).map(([id, c]) => ({ elementId: id, count: c }));
}
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function isChallengePedagogicallyValid(availableTokens: TokenCount[], fixedPlacements: FixedPlacement[], composition: Composition): boolean {
  const availableIds = new Set(availableTokens.map(t => t.elementId));
  const inCompo = (id: string) => ((composition as any)[id] ?? 0) > 0;
  const countAvail = (id: string) => availableTokens.find(t => t.elementId === id)?.count ?? 0;
  const countFixed = (id: string) => fixedPlacements.filter(fp => fp.elementId === id).length;
  const totalInCompo = (id: string) => (composition as any)[id] ?? 0;
  if (inCompo('chien')) { if (!availableIds.has('chien')) return false; if (countAvail('chien') < 2) return false; }
  if (inCompo('chalet') && !availableIds.has('bucheron')) return false;
  if (inCompo('ruche')) {
    const oursTotal = totalInCompo('ours'); const oursFixed = countFixed('ours');
    const rucheIsFixed = fixedPlacements.some(fp => fp.elementId === 'ruche');
    if (oursTotal >= 2) { if (rucheIsFixed) return false; } else { if (rucheIsFixed && oursFixed >= 1) return false; }
  }
  if (inCompo('cerf') && inCompo('biche')) {
    const cerfFixed = countFixed('cerf'); const bicheFixed = countFixed('biche');
    const cerfTotal = totalInCompo('cerf'); const bicheTotal = totalInCompo('biche');
    if (cerfFixed >= cerfTotal && bicheFixed >= bicheTotal) return false;
  }
  for (const [id, total] of Object.entries(composition)) {
    if ((total ?? 0) < 2) continue;
    if (countAvail(id) === 0) return false;
  }
  return true;
}

const levelArg = (process.argv[2] as keyof typeof LEVEL_PARAMS) || 'niveau_6';
const params = LEVEL_PARAMS[levelArg];
const [minEmpty, maxEmpty] = params.emptyCellsRange;
const targetFixed = params.cellCount - minEmpty; // ici min=max -> fixes = cellCount - vides

console.log(`Niveau teste : ${levelArg}`);
console.log(`Test de 3000 tirages aleatoires de fixedPlacements par composition (${minEmpty} vides / ${params.cellCount} cases, ${targetFixed} fixes)\n`);
console.log(`Nombre de compositions dans ${levelArg} : ${params.compositions.length}\n`);

let compositionsOk = 0;
const compositionsFailed: string[] = [];

params.compositions.forEach((composition, idx) => {
  const total = Object.values(composition).reduce((a, b) => a + (b ?? 0), 0);
  const label = Object.entries(composition).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => k.substring(0, 3) + v).join('+');
  if (total !== params.cellCount) {
    console.log(`[${idx}] ${label.padEnd(45)} ERREUR total=${total} != ${params.cellCount}`);
    compositionsFailed.push(label);
    return;
  }
  const fullTokens = compositionToTokens(composition);
  const fullResult = solve({ boardDef: board_9_v1, fixedPlacements: [], availableTokens: fullTokens, elementDefs });
  if (fullResult.solutionCount < 2) {
    console.log(`[${idx}] ${label.padEnd(45)} full solve < 2, skip`);
    compositionsFailed.push(label);
    return;
  }

  let pedagoOk = 0, uniqueOk = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) {
    const solution = fullResult.solutions[Math.floor(Math.random() * fullResult.solutions.length)];
    const fixedIndices = shuffleArray([...Array(params.cellCount).keys()]).slice(0, targetFixed);
    const fixedPlacements: FixedPlacement[] = fixedIndices.map(idx2 => ({ cellIndex: idx2, elementId: solution[idx2] }));
    const availableTokens = computeAvailable(composition, fixedPlacements);
    if (!isChallengePedagogicallyValid(availableTokens, fixedPlacements, composition)) continue;
    pedagoOk++;
    const result = solve({ boardDef: board_9_v1, fixedPlacements, availableTokens, elementDefs });
    if (result.solutionCount === 1) uniqueOk++;
  }
  const status = uniqueOk > 0 ? 'OK' : 'ECHEC';
  if (uniqueOk > 0) compositionsOk++; else compositionsFailed.push(label);
  console.log(`[${idx}] ${label.padEnd(45)} pedagoOk=${pedagoOk}/${N}  uniqueOk=${uniqueOk}/${N}  ${status}`);
});

console.log(`\n=== RESUME ===`);
console.log(`Compositions viables (uniqueOk > 0) : ${compositionsOk}/${params.compositions.length}`);
if (compositionsFailed.length > 0) {
  console.log('Compositions a risque/echec :');
  compositionsFailed.forEach(l => console.log(`  - ${l}`));
}
