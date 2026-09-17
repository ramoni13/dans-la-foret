// ============================================================
// SCRIPT DE GENERATION DES DEFIS - V2
// 10 niveaux x 4 plateaux x compositions controlees
// Logique fidelee au DLF_Maker : composition precise + unicite
// Execution : npm run generate
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';
import { Challenge, DifficultyLevel, FixedPlacement, TokenCount } from '../src/core/models/Challenge';
import { LEVEL_PARAMS, Composition } from '../src/constants/difficulty';
import { solve } from '../src/core/engine/solver';

// ── Elements SANS require() d'assets ───────────────────────
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
  chien: {
    id: 'chien', label: 'Chien', icon: ICON, color: '#D2691E', maxPerBoard: 4,
    constraints: [{ type: 'neighbor_same', mode: 'require', scope: 'neighbor', minCount: 1 }],
  },
  chalet: {
    id: 'chalet', label: 'Chalet', icon: ICON, color: '#A0522D', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', mode: 'require', scope: 'neighbor', targetElementId: 'bucheron', minCount: 1 },
    ],
  },
  renard: {
    id: 'renard', label: 'Renard', icon: ICON, color: '#FF6B35', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', mode: 'forbid', scope: 'neighbor', targetElementId: 'mouton' },
    ],
  },
};

// ── Plateaux SANS require() d'assets ───────────────────────
const boards: Record<string, BoardDefinition> = {

  board_6_v1: {
    id: 'board_6_v1', label: 'Clairiere', cellCount: 6,
    connections: [
      [1, 3],       // 0
      [0, 2, 4, 5], // 1
      [1, 3, 4],    // 2
      [0, 2, 4, 5], // 3
      [1, 2, 3],    // 4
      [1, 3],       // 5
    ],
    cellPositions: [
      { x: 43, y: 8 }, { x: 19, y: 42 }, { x: 43, y: 29 },
      { x: 67, y: 42 }, { x: 43, y: 56 }, { x: 43, y: 78 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  },

  board_8_v2: {
    id: 'board_8_v2', label: 'Lisiere', cellCount: 8,
    connections: [
      [1, 2, 5],       // 0
      [0, 3],          // 1
      [0, 4],          // 2
      [1, 4, 5, 6],    // 3
      [2, 3, 5, 7],    // 4
      [0, 3, 4, 6, 7], // 5
      [3, 5],          // 6
      [4, 5],          // 7
    ],
    cellPositions: [
      { x: 50, y: 12 }, { x: 20, y: 28 }, { x: 80, y: 28 },
      { x: 20, y: 52 }, { x: 80, y: 52 }, { x: 50, y: 62 },
      { x: 20, y: 80 }, { x: 80, y: 80 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  },

  board_10_v3: {
    id: 'board_10_v3', label: 'Sous-bois', cellCount: 10,
    connections: [
      [3],             // 0
      [4, 5],          // 1
      [3],             // 2
      [0, 2, 4, 5, 6], // 3
      [1, 3, 6, 8],    // 4
      [1, 3, 6, 8],    // 5
      [3, 4, 5, 7, 9], // 6
      [6],             // 7
      [4, 5],          // 8
      [6],             // 9
    ],
    cellPositions: [
      { x: 10, y: 8 }, { x: 50, y: 8 }, { x: 88, y: 8 },
      { x: 50, y: 30 }, { x: 22, y: 50 }, { x: 78, y: 50 },
      { x: 50, y: 68 }, { x: 10, y: 88 }, { x: 50, y: 88 }, { x: 88, y: 88 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  },

  board_12: {
    id: 'board_12', label: 'Foret Profonde', cellCount: 12,
    connections: [
      [1, 3, 4, 10],  // 0
      [0, 2, 5, 11],  // 1
      [1, 3, 4, 9],   // 2
      [0, 2, 5, 8],   // 3
      [0, 2, 6, 7],   // 4
      [1, 3, 6, 7],   // 5
      [4, 5, 8, 10],  // 6
      [4, 5, 9, 11],  // 7
      [3, 6, 9, 11],  // 8
      [2, 7, 8, 10],  // 9
      [0, 6, 9, 11],  // 10
      [1, 7, 8, 10],  // 11
    ],
    cellPositions: [
      { x: 4, y: 3 }, { x: 81, y: 3 }, { x: 31, y: 15 }, { x: 54, y: 15 },
      { x: 15, y: 32 }, { x: 71, y: 32 }, { x: 15, y: 55 }, { x: 71, y: 55 },
      { x: 31, y: 72 }, { x: 54, y: 72 }, { x: 4, y: 84 }, { x: 81, y: 84 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
    specialCells: { corners: [0, 1, 10, 11], edges: [2, 3, 4, 5, 6, 7, 8, 9] },
  },
};

// ── Generateur d'un defi unique ─────────────────────────────
function generateOneChallenge(
  level: DifficultyLevel,
  challengeNumber: number
): Challenge | null {
  const params = LEVEL_PARAMS[level];
  const boardDef = boards[params.boardId];
  if (!boardDef) return null;

  // Choisir une composition aleatoire parmi celles du niveau
  const composition = params.compositions[
    Math.floor(Math.random() * params.compositions.length)
  ];

  // Verifier que le total = cellCount
  const total = Object.values(composition).reduce((a, b) => a + (b ?? 0), 0);
  if (total !== params.cellCount) {
    console.warn(`  Composition invalide pour ${level}: total=${total} != cellCount=${params.cellCount}`);
    return null;
  }

  // Construire l'inventaire complet
  const fullTokens: TokenCount[] = Object.entries(composition)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([elementId, count]) => ({ elementId, count: count! }));

  // Etape 1 : Trouver une solution valide avec cette composition
  const fullResult = solve({
    boardDef,
    fixedPlacements: [],
    availableTokens: fullTokens,
    elementDefs,
  });

  if (fullResult.solutions.length === 0) return null;

  // Choisir une solution aleatoire
  const solution = fullResult.solutions[
    Math.floor(Math.random() * fullResult.solutions.length)
  ];

  // Etape 2 : Choisir le nombre de cases fixes dans la plage du niveau
  const [minEmpty, maxEmpty] = params.emptyCellsRange;
  const targetEmpty = minEmpty + Math.floor(Math.random() * (maxEmpty - minEmpty + 1));
  const targetFixed = params.cellCount - targetEmpty;

  // Etape 3 : Trouver une combinaison de cases fixes avec solution unique
  for (let attempt = 0; attempt < 40; attempt++) {
    const shuffled = shuffleArray([...Array(params.cellCount).keys()]);
    const fixedIndices = shuffled.slice(0, targetFixed);

    const fixedPlacements: FixedPlacement[] = fixedIndices.map(idx => ({
      cellIndex: idx,
      elementId: solution[idx],
    }));

    // Jetons disponibles = composition totale - jetons fixes
    const availableTokens = computeAvailable(composition, fixedPlacements);

    // Verifier la validite pedagogique (elements relationnels jouables)
    if (!isChallengePedagogicallyValid(availableTokens, composition)) continue;

    // Verifier l'unicite
    const result = solve({ boardDef, fixedPlacements, availableTokens, elementDefs });

    if (result.isUnique) {
      const id = `${level}_${String(challengeNumber).padStart(3, '0')}`;
      const [durMin, durMax] = params.estimatedDurationRange;
      return {
        id,
        boardId: params.boardId,
        level,
        levelNumber: challengeNumber,
        challengeNumber,
        fixedPlacements,
        availableTokens,
        solution,
        solutionCount: 1,
        estimatedDuration: Math.round((durMin + durMax) / 2),
        createdAt: new Date().toISOString(),
      };
    }
  }

  return null;
}

function computeAvailable(
  composition: Composition,
  fixedPlacements: FixedPlacement[]
): TokenCount[] {
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

/**
 * Vérifie que le défi est pédagogiquement valide :
 * - Chaque élément à contrainte relationnelle présent dans la solution
 *   doit avoir AU MOINS 1 jeton à poser (pas tout en cases fixes).
 *
 * Éléments à contrainte relationnelle :
 *   - chien  : doit être voisin d'un autre chien
 *   - chalet : doit être voisin d'un bucheron
 *   - renard : ne peut pas être voisin d'un mouton
 *   - mouton : ne peut pas être voisin d'un renard
 *
 * Si tous les chiens sont fixés, le joueur n'a aucune décision
 * à prendre sur leur placement → défi invalide.
 */
function isChallengePedagogicallyValid(
  availableTokens: TokenCount[],
  composition: Composition
): boolean {
  const availableIds = new Set(availableTokens.map(t => t.elementId));
  const inCompo = (id: string) => ((composition as any)[id] ?? 0) > 0;

  // Règle 1 : si chien est dans la composition, au moins 1 chien doit être à poser
  // (le joueur doit décider où placer la meute)
  if (inCompo('chien') && !availableIds.has('chien')) return false;

  // Règle 2 : si chalet est dans la composition, au moins 1 chalet OU 1 bucheron
  // doit être à poser (sinon la contrainte chalet-bucheron est invisible)
  if (inCompo('chalet') && !availableIds.has('chalet') && !availableIds.has('bucheron')) return false;

  // Règle 3 : si renard est dans la composition, au moins 1 renard OU 1 mouton
  // doit être à poser (sinon la contrainte renard-mouton est invisible)
  if (inCompo('renard') && !availableIds.has('renard') && !availableIds.has('mouton')) return false;

  return true;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Configuration : 10 niveaux ──────────────────────────────
const CONFIGS: Array<{ level: DifficultyLevel; count: number }> = [
  { level: 'niveau_1', count: 10 },
  { level: 'niveau_2', count: 10 },
  { level: 'niveau_3', count: 10 },
  { level: 'niveau_4', count: 10 },
  { level: 'niveau_5', count: 10 },
  { level: 'niveau_6', count: 10 },
  { level: 'niveau_7', count: 10 },
  { level: 'niveau_8', count: 10 },
  { level: 'niveau_9', count: 10 },
  { level: 'niveau_10', count: 10 },
  { level: 'niveau_11', count: 10 },
  { level: 'niveau_12', count: 10 },
  { level: 'niveau_13', count: 10 },
];

// ── Generation principale ───────────────────────────────────
function generateAll() {
  console.log('Generateur de defis V2 - Dans la Foret');
  console.log('13 niveaux x 4 plateaux x 10 defis chacun (cases vides fixes)\n');

  let totalGenerated = 0;

  for (const { level, count } of CONFIGS) {
    const params = LEVEL_PARAMS[level];
    console.log(`\n[${level.toUpperCase()}] plateau ${params.cellCount} cases, ${count} defis...`);

    const challenges: Challenge[] = [];
    let attempts = 0;
    const maxAttempts = count * 60;

    while (challenges.length < count && attempts < maxAttempts) {
      attempts++;
      const c = generateOneChallenge(level, challenges.length + 1);
      if (c) {
        challenges.push(c);
        if (challenges.length % 5 === 0) {
          process.stdout.write(`  ${challenges.length}/${count} (${attempts} tentatives)\n`);
        }
      }
    }

    if (challenges.length < count) {
      console.warn(`  ATTENTION: ${challenges.length}/${count} seulement apres ${attempts} tentatives`);
    } else {
      console.log(`  OK: ${challenges.length}/${count} en ${attempts} tentatives`);
    }

    // Ecrire le JSON
    const outputPath = path.resolve(__dirname, `../src/data/challenges/${level}.json`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ challenges }, null, 2), 'utf-8');
    console.log(`  Fichier: ${outputPath}`);
    console.log(`  Stats: ${analyzeStats(challenges, params.cellCount)}`);
    totalGenerated += challenges.length;
  }

  console.log(`\nTermine ! ${totalGenerated} defis generes au total.`);
}

function analyzeStats(challenges: Challenge[], cellCount: number): string {
  if (!challenges.length) return 'aucun';
  const avgFixed = challenges.reduce((s, c) => s + c.fixedPlacements.length, 0) / challenges.length;
  const avgEmpty = cellCount - avgFixed;
  const avgTypes = challenges.reduce((s, c) => s + new Set(c.solution).size, 0) / challenges.length;
  return `fixes: ${avgFixed.toFixed(1)}, vides: ${avgEmpty.toFixed(1)}, types: ${avgTypes.toFixed(1)}`;
}

generateAll();
