// ============================================================
// SCRIPT DE REGENERATION CIBLEE DES DEFIS
//
// Usage :
//   npm run regenerate -- --level niveau_3
//   npm run regenerate -- --level niveau_3 --defis 8,9
//   npm run regenerate -- --level niveau_6 --level niveau_7
//
// Comportement :
//   - Sans --defis : regenere tout le niveau (memes IDs, meme ordre)
//   - Avec --defis  : regenere uniquement les defis specifies (par numero)
//   - Lance generateViewerData automatiquement a la fin
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';
import { Challenge, DifficultyLevel, FixedPlacement, TokenCount } from '../src/core/models/Challenge';
import { LEVEL_PARAMS, Composition, LevelParams } from '../src/constants/difficulty';
import { solve } from '../src/core/engine/solver';

// ============================================================
// Parsing des arguments CLI
// Supporte deux formes :
//   Forme flags  : --level niveau_3 --defis 8,9
//   Forme simple : niveau_3 8,9   (ou niveau_3 8 9)
// ============================================================
function parseArgs(): { levels: DifficultyLevel[]; defis: number[] | null } {
  const args = process.argv.slice(2);
  const levels: DifficultyLevel[] = [];
  let defis: number[] | null = null;

  // Forme flags (--level, --defis)
  if (args.some(a => a.startsWith('--'))) {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--level' && args[i + 1]) {
        levels.push(args[++i] as DifficultyLevel);
      } else if (args[i] === '--defis' && args[i + 1]) {
        defis = args[++i].split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
      }
    }
  } else {
    // Forme simple : premier arg = niveau, args suivants = numeros de defis
    // Ex: niveau_3 8,9  ou  niveau_3 "8 9"  ou  niveau_3 8 9
    if (args[0]) levels.push(args[0] as DifficultyLevel);
    if (args.length > 1) {
      // Joindre tous les args restants, remplacer espaces par virgules, puis splitter
      const defiArgs = args.slice(1).join(',').replace(/\s+/g, ',');
      const parsed = defiArgs.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
      if (parsed.length > 0) defis = parsed;
    }
  }

  if (levels.length === 0) {
    console.error('Usage:');
    console.error('  npm run regenerate -- --level niveau_X [--level niveau_Y] [--defis 8,9]');
    console.error('  npm run regenerate -- niveau_3 8,9');
    process.exit(1);
  }

  if (defis !== null && levels.length > 1) {
    console.error('--defis ne peut etre utilise qu\'avec un seul niveau');
    process.exit(1);
  }

  return { levels, defis };
}

// ============================================================
// Elements et plateaux (identiques a generateChallenges.ts)
// ============================================================
const ICON: any = 'placeholder';

const elementDefs: Record<string, ElementDefinition> = {
  bucheron: {
    id: 'bucheron', label: 'Bucheron', icon: ICON, color: '#8B4513', maxPerBoard: 4,
    constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }],
  },
  ours: {
    id: 'ours', label: 'Ours', icon: ICON, color: '#6B4226', maxPerBoard: 4,
    constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }],
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
    constraints: [
      { type: 'neighbor_specific', targetElementId: 'ours', mode: 'require', scope: 'neighbor', minCount: 1 },
    ],
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
    id: 'tas_buches', label: 'Tas de buches', icon: ICON, color: '#6D4C2A', maxPerBoard: 4,
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
};

const boards: Record<string, BoardDefinition> = {
  board_6_v1: {
    id: 'board_6_v1', label: 'Clairiere', cellCount: 6,
    connections: [[1, 3], [0, 2, 4, 5], [1, 3, 4], [0, 2, 4, 5], [1, 2, 3], [1, 3]],
    cellPositions: [
      { x: 43, y: 8 }, { x: 19, y: 42 }, { x: 43, y: 29 }, { x: 67, y: 42 }, { x: 43, y: 56 }, { x: 43, y: 78 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  },
  board_7_v1: {
    id: 'board_7_v1', label: 'Clairiere', cellCount: 7,
    connections: [[1, 2], [0, 3, 4], [0, 3, 5], [1, 2, 4, 5], [1, 3, 6], [2, 3, 6], [4, 5]],
    cellPositions: [
      { x: 50, y: 10 }, { x: 25, y: 32 }, { x: 75, y: 32 }, { x: 50, y: 50 }, { x: 25, y: 68 }, { x: 75, y: 68 }, { x: 50, y: 88 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  },
  board_8_v2: {
    id: 'board_8_v2', label: 'Lisiere', cellCount: 8,
    connections: [[1, 2, 5], [0, 3], [0, 4], [1, 4, 5, 6], [2, 3, 5, 7], [0, 3, 4, 6, 7], [3, 5], [4, 5]],
    cellPositions: [
      { x: 50, y: 12 }, { x: 20, y: 28 }, { x: 80, y: 28 }, { x: 20, y: 52 }, { x: 80, y: 52 }, { x: 50, y: 62 }, { x: 20, y: 80 }, { x: 80, y: 80 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  },
  board_10_v3: {
    id: 'board_10_v3', label: 'Sous-bois', cellCount: 10,
    connections: [[3], [4, 5], [3], [0, 2, 4, 5, 6], [1, 3, 6, 8], [1, 3, 6, 8], [3, 4, 5, 7, 9], [6], [4, 5], [6]],
    cellPositions: [
      { x: 10, y: 8 }, { x: 50, y: 8 }, { x: 88, y: 8 }, { x: 50, y: 30 }, { x: 22, y: 50 }, { x: 78, y: 50 },
      { x: 50, y: 68 }, { x: 10, y: 88 }, { x: 50, y: 88 }, { x: 88, y: 88 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  },
  board_12: {
    id: 'board_12', label: 'Foret Profonde', cellCount: 12,
    connections: [
      [1, 3, 4, 10], [0, 2, 5, 11], [1, 3, 4, 9], [0, 2, 5, 8], [0, 2, 6, 7], [1, 3, 6, 7],
      [4, 5, 8, 10], [4, 5, 9, 11], [3, 6, 9, 11], [2, 7, 8, 10], [0, 6, 9, 11], [1, 7, 8, 10],
    ],
    cellPositions: [
      { x: 4, y: 3 }, { x: 81, y: 3 }, { x: 31, y: 15 }, { x: 54, y: 15 }, { x: 15, y: 32 }, { x: 71, y: 32 },
      { x: 15, y: 55 }, { x: 71, y: 55 }, { x: 31, y: 72 }, { x: 54, y: 72 }, { x: 4, y: 84 }, { x: 81, y: 84 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
    specialCells: { corners: [0, 1, 10, 11], edges: [2, 3, 4, 5, 6, 7, 8, 9] },
  },
};

// ============================================================
// Utilitaires (identiques a generateChallenges.ts)
// ============================================================
function solutionSignature(solution: string[]): string {
  return solution.join(',');
}

function challengeSignature(fixedPlacements: FixedPlacement[]): string {
  return fixedPlacements
    .slice()
    .sort((a, b) => a.cellIndex - b.cellIndex)
    .map(fp => `${fp.cellIndex}:${fp.elementId}`)
    .join('|');
}

function compositionToTokens(composition: Composition): TokenCount[] {
  return Object.entries(composition)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([elementId, count]) => ({ elementId, count: count! }));
}

function computeAvailable(composition: Composition, fixedPlacements: FixedPlacement[]): TokenCount[] {
  const remaining: Record<string, number> = {};
  for (const [id, count] of Object.entries(composition)) {
    if ((count ?? 0) > 0) remaining[id] = count!;
  }
  for (const fp of fixedPlacements) {
    if (remaining[fp.elementId] !== undefined) remaining[fp.elementId]--;
  }
  return Object.entries(remaining)
    .filter(([, c]) => c > 0)
    .map(([elementId, count]) => ({ elementId, count }));
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isChallengePedagogicallyValid(
  availableTokens: TokenCount[],
  fixedPlacements: FixedPlacement[],
  composition: Composition
): boolean {
  const availableIds = new Set(availableTokens.map(t => t.elementId));
  const inCompo = (id: string) => ((composition as any)[id] ?? 0) > 0;
  const countAvail = (id: string) => availableTokens.find(t => t.elementId === id)?.count ?? 0;
  const countFixed = (id: string) => fixedPlacements.filter(fp => fp.elementId === id).length;
  const totalInCompo = (id: string) => (composition as any)[id] ?? 0;

  if (inCompo('chien')) {
    if (!availableIds.has('chien')) return false;
    if (countAvail('chien') < 2) return false;
  }
  if (inCompo('chalet') && !availableIds.has('bucheron')) return false;

  if (inCompo('ruche')) {
    const oursTotal = totalInCompo('ours');
    const oursFixed = countFixed('ours');
    const rucheIsFixed = fixedPlacements.some(fp => fp.elementId === 'ruche');
    if (oursTotal >= 2) {
      if (rucheIsFixed) return false;
    } else {
      if (rucheIsFixed && oursFixed >= 1) return false;
    }
  }

  if (inCompo('cerf') && inCompo('biche')) {
    const cerfFixed = countFixed('cerf');
    const bicheFixed = countFixed('biche');
    const cerfTotal = totalInCompo('cerf');
    const bicheTotal = totalInCompo('biche');
    if (cerfFixed >= cerfTotal && bicheFixed >= bicheTotal) return false;
  }

  for (const [id, total] of Object.entries(composition)) {
    if ((total ?? 0) < 2) continue;
    if (countAvail(id) === 0) return false;
  }
  return true;
}

function isNarrativelyInteresting(
  availableTokens: TokenCount[],
  _fixedPlacements: FixedPlacement[],
  composition: Composition
): boolean {
  const availableIds = new Set(availableTokens.map(t => t.elementId));
  const inCompo = (id: string) => ((composition as any)[id] ?? 0) > 0;
  if (inCompo('chalet') && !availableIds.has('bucheron')) return false;
  return true;
}

function verifySolutionConsistency(
  solution: string[],
  fixedPlacements: FixedPlacement[],
  availableTokens: TokenCount[],
  boardDef: BoardDefinition
): boolean {
  for (const fp of fixedPlacements) {
    if (solution[fp.cellIndex] !== fp.elementId) return false;
  }
  const check = solve({ boardDef, fixedPlacements, availableTokens, elementDefs });
  if (check.solutionCount !== 1) return false;
  return check.solutions[0].every((el, i) => el === solution[i]);
}

function buildChallenge(
  level: DifficultyLevel,
  challengeNumber: number,
  params: LevelParams,
  fixedPlacements: FixedPlacement[],
  availableTokens: TokenCount[],
  solution: string[]
): Challenge {
  const id = `${level}_${String(challengeNumber).padStart(3, '0')}`;
  const [durMin, durMax] = params.estimatedDurationRange;
  return {
    id, boardId: params.boardId, level,
    levelNumber: challengeNumber, challengeNumber,
    fixedPlacements, availableTokens, solution,
    solutionCount: 1,
    estimatedDuration: Math.round((durMin + durMax) / 2),
    createdAt: new Date().toISOString(),
  };
}

// ============================================================
// Generateur d'un defi unique (meme logique que generateChallenges.ts)
// usedSolutions : solutions deja utilisees dans ce niveau (pour eviter les doublons)
// bannedSolutions : solutions a exclure absolument (ex: solutions des defis conserves)
// ============================================================
function generateOneChallenge(
  level: DifficultyLevel,
  challengeNumber: number,
  usedSolutions: Set<string>,
  usedChallenges: Set<string>,
  compositionUsageCount: Map<number, number>
): Challenge | null {
  const params = LEVEL_PARAMS[level];
  const boardDef = boards[params.boardId];
  if (!boardDef) return null;

  const compositionIndices = shuffleArray(params.compositions.map((_, i) => i))
    .sort((a, b) => (compositionUsageCount.get(a) ?? 0) - (compositionUsageCount.get(b) ?? 0));

  for (const compIdx of compositionIndices) {
    const composition = params.compositions[compIdx];
    const total = Object.values(composition).reduce((a, b) => a + (b ?? 0), 0);
    if (total !== params.cellCount) continue;

    const fullTokens = compositionToTokens(composition);
    const fullResult = solve({ boardDef, fixedPlacements: [], availableTokens: fullTokens, elementDefs });
    if (fullResult.solutionCount === 0) continue;
    if (fullResult.solutionCount < 2) continue;

    const freshSolutions = fullResult.solutions.filter(
      s => !usedSolutions.has(solutionSignature(s))
    );
    if (freshSolutions.length === 0) continue;

    for (const solution of shuffleArray(freshSolutions)) {
      const [minEmpty, maxEmpty] = params.emptyCellsRange;
      const targetEmpty = minEmpty + Math.floor(Math.random() * (maxEmpty - minEmpty + 1));
      const targetFixed = params.cellCount - targetEmpty;

      for (let attempt = 0; attempt < 120; attempt++) {
        const fixedIndices = shuffleArray([...Array(params.cellCount).keys()]).slice(0, targetFixed);
        const fixedPlacements: FixedPlacement[] = fixedIndices.map(idx => ({
          cellIndex: idx,
          elementId: solution[idx],
        }));

        const cSig = challengeSignature(fixedPlacements);
        if (usedChallenges.has(cSig)) continue;

        const availableTokens = computeAvailable(composition, fixedPlacements);
        if (!isChallengePedagogicallyValid(availableTokens, fixedPlacements, composition)) continue;
        if (!isNarrativelyInteresting(availableTokens, fixedPlacements, composition)) continue;

        const result = solve({ boardDef, fixedPlacements, availableTokens, elementDefs });
        if (result.solutionCount !== 1) continue;

        if (!verifySolutionConsistency(solution, fixedPlacements, availableTokens, boardDef)) continue;

        usedSolutions.add(solutionSignature(solution));
        usedChallenges.add(cSig);
        compositionUsageCount.set(compIdx, (compositionUsageCount.get(compIdx) ?? 0) + 1);
        return buildChallenge(level, challengeNumber, params, fixedPlacements, availableTokens, solution);
      }
    }
  }
  return null;
}

// ============================================================
// Chargement du JSON existant d'un niveau
// ============================================================
function loadExistingChallenges(level: DifficultyLevel): Challenge[] {
  const filePath = path.resolve(__dirname, `../src/data/challenges/${level}.json`);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw).challenges ?? [];
  } catch {
    return [];
  }
}

// ============================================================
// Regeneration d'un niveau complet ou de defis specifiques
// ============================================================
function regenerateLevel(level: DifficultyLevel, defiNumbers: number[] | null): void {
  const params = LEVEL_PARAMS[level];
  const existing = loadExistingChallenges(level);
  const totalCount = existing.length > 0 ? existing.length : 10;

  // Determiner quels numeros de defis regenerer
  const toRegenerate = new Set<number>(
    defiNumbers !== null
      ? defiNumbers.filter(n => n >= 1 && n <= totalCount)
      : Array.from({ length: totalCount }, (_, i) => i + 1)
  );

  if (toRegenerate.size === 0) {
    console.log(`  Aucun defi valide a regenerer pour ${level}`);
    return;
  }

  console.log(`  Defis a regenerer : ${[...toRegenerate].sort((a, b) => a - b).join(', ')}`);

  // Construire les memoires a partir des defis CONSERVES
  const usedSolutions = new Set<string>();
  const usedChallenges = new Set<string>();
  const compositionUsageCount = new Map<number, number>();

  for (const challenge of existing) {
    if (!toRegenerate.has(challenge.challengeNumber)) {
      // Defi conserve : enregistrer sa solution et ses fixedPlacements
      usedSolutions.add(solutionSignature(challenge.solution));
      usedChallenges.add(challengeSignature(challenge.fixedPlacements));
    }
  }

  // Regenerer les defis cibles
  const newChallenges: Challenge[] = [];
  let attempts = 0;
  const maxAttempts = toRegenerate.size * 300;

  const toRegenerateList = [...toRegenerate].sort((a, b) => a - b);

  for (const num of toRegenerateList) {
    let generated = false;
    while (!generated && attempts < maxAttempts) {
      attempts++;
      const c = generateOneChallenge(level, num, usedSolutions, usedChallenges, compositionUsageCount);
      if (c) {
        newChallenges.push(c);
        generated = true;
        console.log(`  ✓ Defi ${num} regenere (${attempts} tentatives)`);
      }
    }
    if (!generated) {
      console.warn(`  ✗ Defi ${num} : echec apres ${maxAttempts} tentatives — defi original conserve`);
      const original = existing.find(c => c.challengeNumber === num);
      if (original) newChallenges.push(original);
    }
  }

  // Reconstruire le tableau complet en preservant l'ordre
  const result: Challenge[] = [];
  for (let i = 1; i <= totalCount; i++) {
    if (toRegenerate.has(i)) {
      const newC = newChallenges.find(c => c.challengeNumber === i);
      if (newC) result.push(newC);
    } else {
      const kept = existing.find(c => c.challengeNumber === i);
      if (kept) result.push(kept);
    }
  }

  // Ecrire le JSON
  const outputPath = path.resolve(__dirname, `../src/data/challenges/${level}.json`);
  fs.writeFileSync(outputPath, JSON.stringify({ challenges: result }, null, 2), 'utf-8');
  console.log(`  Fichier mis a jour : ${outputPath}`);

  // Stats
  const solutions = result.map(c => solutionSignature(c.solution));
  const uniqueSolutions = new Set(solutions).size;
  console.log(`  Solutions uniques : ${uniqueSolutions}/${result.length}`);
  if (uniqueSolutions < result.length) {
    const dupes = solutions.filter((s, i) => solutions.indexOf(s) !== i);
    console.warn(`  ATTENTION doublons de solutions : ${[...new Set(dupes)].join(' | ')}`);
  }
}

// ============================================================
// Point d'entree
// ============================================================
function main() {
  const { levels, defis } = parseArgs();

  console.log('\nRegenerateur cible — Dans la Foret');
  console.log(`Niveaux : ${levels.join(', ')}`);
  if (defis) console.log(`Defis   : ${defis.join(', ')}`);
  console.log('');

  for (const level of levels) {
    if (!LEVEL_PARAMS[level]) {
      console.error(`Niveau inconnu : ${level}`);
      continue;
    }
    console.log(`[${level.toUpperCase()}]`);
    regenerateLevel(level, defis);
    console.log('');
  }

  // Regenerer le viewer
  console.log('Mise a jour du viewer...');
  try {
    execSync(
      'npx ts-node --project tsconfig.scripts.json scripts/generateViewerData.ts',
      { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' }
    );
  } catch (e) {
    console.error('Erreur lors de la generation du viewer :', e);
  }
}

main();
