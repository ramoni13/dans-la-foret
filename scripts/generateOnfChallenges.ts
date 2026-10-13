// ============================================================
// SCRIPT DE GÉNÉRATION DES DÉFIS ONF — 100 défis 4×4
// Génère src/data/onf_challenges.json
//
// Exécution : npm run generate:onf
//
// Tous les défis sont générés avec 4 cases fixes (difficulté uniforme).
// La solution unique est garantie par le solveur backtracking.
// Chaque défi reçoit un ID stable : onf_4x4_001 … onf_4x4_100.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';
import { Challenge, FixedPlacement, TokenCount } from '../src/core/models/Challenge';
import { solveOnf } from '../src/core/engine/solver';

// ── Plateau 4×4 ONF (inline, sans require() d'assets) ────────────────────────

const board4x4Onf: BoardDefinition = {
  id: 'board_4x4_onf',
  label: 'Forêt Carrée',
  cellCount: 16,
  connections: [
    [1, 4],           //  0
    [0, 2, 5],        //  1
    [1, 3, 6],        //  2
    [2, 7],           //  3
    [0, 5, 8],        //  4
    [1, 4, 6, 9],     //  5
    [2, 5, 7, 10],    //  6
    [3, 6, 11],       //  7
    [4, 9, 12],       //  8
    [5, 8, 10, 13],   //  9
    [6, 9, 11, 14],   // 10
    [7, 10, 15],      // 11
    [8, 13],          // 12
    [9, 12, 14],      // 13
    [10, 13, 15],     // 14
    [11, 14],         // 15
  ],
  cellPositions: [
    { x: 12.5, y: 12.5 }, { x: 37.5, y: 12.5 }, { x: 62.5, y: 12.5 }, { x: 87.5, y: 12.5 },
    { x: 12.5, y: 37.5 }, { x: 37.5, y: 37.5 }, { x: 62.5, y: 37.5 }, { x: 87.5, y: 37.5 },
    { x: 12.5, y: 62.5 }, { x: 37.5, y: 62.5 }, { x: 62.5, y: 62.5 }, { x: 87.5, y: 62.5 },
    { x: 12.5, y: 87.5 }, { x: 37.5, y: 87.5 }, { x: 62.5, y: 87.5 }, { x: 87.5, y: 87.5 },
  ],
  backgroundAsset: null as any,
  availableElements: ['bucheron', 'ours', 'mouton', 'loup', 'ruche', 'cerf', 'biche', 'champignon'],
  specialCells: { center: [5, 6, 9, 10] },
  gridMeta: {
    rows: [[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]],
    cols: [[0,4,8,12], [1,5,9,13], [2,6,10,14], [3,7,11,15]],
  },
};

// ── Éléments inline (sans require() d'assets) ────────────────────────────────

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
  loup: {
    id: 'loup', label: 'Loup', icon: ICON, color: '#FF6B35', maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', mode: 'forbid', scope: 'neighbor', targetElementId: 'mouton' },
    ],
  },
  ruche: {
    id: 'ruche', label: 'Ruche', icon: ICON, color: '#F5A623', maxPerBoard: 1,
    constraints: [],
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
  champignon: {
    id: 'champignon', label: 'Champignon', icon: ICON, color: '#C0392B', maxPerBoard: 3,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
    ],
    placementRules: [{ type: 'center_only' }],
  },
};

// ── Compositions ONF 4×4 ──────────────────────────────────────────────────────

type Composition = Record<string, number>;

const ONF_COMPOSITIONS_4X4: Composition[] = [
  // Famille A — Diversité 6 types
  { bucheron: 4, mouton: 4, ours: 3, loup: 3, cerf: 1, biche: 1 },
  { bucheron: 4, mouton: 3, ours: 4, loup: 3, cerf: 1, biche: 1 },
  { bucheron: 3, mouton: 4, ours: 4, loup: 3, cerf: 1, biche: 1 },
  { bucheron: 4, mouton: 3, ours: 3, loup: 4, cerf: 1, biche: 1 },
  { bucheron: 4, mouton: 4, ours: 2, loup: 4, cerf: 1, biche: 1 },
  { bucheron: 4, mouton: 4, ours: 2, loup: 2, cerf: 2, biche: 2 },
  { bucheron: 3, mouton: 3, ours: 4, loup: 4, cerf: 1, biche: 1 },
  { bucheron: 3, mouton: 4, ours: 3, loup: 4, cerf: 1, biche: 1 },
  { bucheron: 4, mouton: 3, ours: 2, loup: 3, cerf: 2, biche: 2 },
  { bucheron: 3, mouton: 3, ours: 3, loup: 3, cerf: 2, biche: 2 },
  { bucheron: 4, mouton: 2, ours: 4, loup: 2, cerf: 2, biche: 2 },
  { bucheron: 2, mouton: 4, ours: 4, loup: 2, cerf: 2, biche: 2 },
  // Famille B — Avec ruche
  { ruche: 1, ours: 1, bucheron: 4, mouton: 4, loup: 4, cerf: 1, biche: 1 },
  { ruche: 1, ours: 2, bucheron: 4, mouton: 4, loup: 3, cerf: 1, biche: 1 },
  { ruche: 1, ours: 2, bucheron: 4, mouton: 3, loup: 4, cerf: 1, biche: 1 },
  { ruche: 1, ours: 1, bucheron: 4, mouton: 4, loup: 2, cerf: 2, biche: 2 },
  { ruche: 1, ours: 2, bucheron: 4, mouton: 2, loup: 3, cerf: 2, biche: 2 },
  { ruche: 1, ours: 2, bucheron: 3, mouton: 3, loup: 3, cerf: 2, biche: 2 },
  { ruche: 1, ours: 1, bucheron: 4, mouton: 3, loup: 3, cerf: 2, biche: 2 },
  { ruche: 1, ours: 2, bucheron: 4, mouton: 3, loup: 2, cerf: 2, biche: 2 },
  { ruche: 1, ours: 1, bucheron: 3, mouton: 3, loup: 4, cerf: 2, biche: 2 },
  { ruche: 1, ours: 2, bucheron: 3, mouton: 4, loup: 2, cerf: 2, biche: 2 },
  // Famille C — Avec champignon
  { champignon: 1, bucheron: 4, mouton: 4, loup: 3, cerf: 2, biche: 2 },
  { champignon: 1, bucheron: 4, mouton: 3, ours: 4, loup: 2, cerf: 1, biche: 1 },
  { champignon: 2, bucheron: 4, mouton: 4, ours: 2, loup: 2, cerf: 1, biche: 1 },
  { champignon: 2, bucheron: 4, mouton: 3, ours: 3, loup: 2, cerf: 1, biche: 1 },
  { champignon: 1, bucheron: 4, mouton: 3, ours: 3, loup: 3, cerf: 1, biche: 1 },
  { champignon: 2, bucheron: 4, mouton: 4, ours: 2, loup: 4 },
  { champignon: 2, bucheron: 3, mouton: 4, ours: 3, loup: 2, cerf: 1, biche: 1 },
  { champignon: 1, bucheron: 3, mouton: 4, ours: 4, loup: 2, cerf: 1, biche: 1 },
  // Famille D — Cerf/biche dominants
  { cerf: 4, biche: 4, bucheron: 4, mouton: 2, loup: 2 },
  { cerf: 3, biche: 3, bucheron: 4, mouton: 3, ours: 3 },
  { cerf: 3, biche: 3, bucheron: 4, mouton: 2, ours: 2, loup: 2 },
  { cerf: 2, biche: 2, bucheron: 4, mouton: 4, ours: 2, loup: 2 },
  { cerf: 2, biche: 2, bucheron: 4, mouton: 3, ours: 3, loup: 2 },
  { cerf: 2, biche: 2, bucheron: 3, mouton: 4, ours: 3, loup: 2 },
];

// ── Utilitaires ───────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function zeroPad(n: number, len: number = 3): string {
  return String(n).padStart(len, '0');
}

// ── Générateur principal ──────────────────────────────────────────────────────

const TOTAL = 100;
const FIXED_COUNT = 5; // 5 cases fixes : unicité plus facilement obtenue
const MAX_ATTEMPTS_PER_CHALLENGE = 80;
const gridMeta = board4x4Onf.gridMeta!;

function generateOneChallengeWithId(id: string): Challenge | null {
  const shuffledCompos = shuffle(ONF_COMPOSITIONS_4X4);

  let attempts = 0;
  for (const composition of shuffledCompos) {
    if (attempts >= MAX_ATTEMPTS_PER_CHALLENGE) break;

    const fullTokens: TokenCount[] = Object.entries(composition)
      .filter(([, v]) => (v as number) > 0)
      .map(([elementId, count]) => ({ elementId, count: count as number }));

    const total = fullTokens.reduce((acc, t) => acc + t.count, 0);
    if (total !== 16) continue;

    for (let inner = 0; inner < 5; inner++) {
      attempts++;
      if (attempts > MAX_ATTEMPTS_PER_CHALLENGE) break;

      // 1. Trouver UNE solution complète via le vrai solveur
      const solverResult = solveOnf({
        boardDef: board4x4Onf,
        fixedPlacements: [],
        availableTokens: fullTokens,
        elementDefs,
        gridMeta,
        maxSolutions: 1,
      });

      if (solverResult.solutionCount === 0) continue;

      const solution = solverResult.solutions[0];

      // 2. Choisir les cases fixes
      const allIndices = shuffle(Array.from({ length: 16 }, (_, i) => i));
      const fixedIndices = allIndices.slice(0, FIXED_COUNT);

      const fixedPlacements: FixedPlacement[] = fixedIndices.map(cellIndex => ({
        cellIndex,
        elementId: solution[cellIndex],
      }));

      // 3. Calculer l'inventaire restant
      const fixedCounts: Record<string, number> = {};
      for (const fp of fixedPlacements) {
        fixedCounts[fp.elementId] = (fixedCounts[fp.elementId] ?? 0) + 1;
      }

      const availableTokens: TokenCount[] = fullTokens
        .map(t => ({
          elementId: t.elementId,
          count: t.count - (fixedCounts[t.elementId] ?? 0),
        }))
        .filter(t => t.count > 0);

      // 4. Vérifier l'unicité avec le vrai solveur
      const uniquenessCheck = solveOnf({
        boardDef: board4x4Onf,
        fixedPlacements,
        availableTokens,
        elementDefs,
        gridMeta,
      });

      if (!uniquenessCheck.isUnique) continue;

      return {
        id,
        boardId: 'board_4x4_onf',
        level: 'niveau_1' as any,
        levelNumber: 0,
        challengeNumber: 0,
        fixedPlacements,
        availableTokens,
        solution,
        solutionCount: 1,
        estimatedDuration: 300,
        createdAt: new Date().toISOString(),
      };
    }
  }

  return null;
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

function main() {
  console.log(`Génération de ${TOTAL} défis ONF 4×4 avec ${FIXED_COUNT} cases fixes…\n`);

  const challenges: Challenge[] = [];
  let failed = 0;

  for (let i = 1; i <= TOTAL; i++) {
    const id = `onf_4x4_${zeroPad(i)}`;
    process.stdout.write(`  [${zeroPad(i)}/${TOTAL}] `);

    const challenge = generateOneChallengeWithId(id);

    if (challenge) {
      challenges.push(challenge);
      const compSummary = [...new Set(challenge.solution)].join(', ');
      process.stdout.write(`OK (${compSummary})\n`);
    } else {
      failed++;
      process.stdout.write(`ECHEC (ignoré)\n`);
    }
  }

  console.log(`\nRésultat : ${challenges.length} défis générés, ${failed} échecs.`);

  if (challenges.length === 0) {
    console.error('Aucun défi généré ! Vérifiez le solveur.');
    process.exit(1);
  }

  const outputPath = path.join(__dirname, '..', 'src', 'data', 'onf_challenges.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(challenges, null, 2), 'utf-8');
  console.log(`\nFichier écrit : ${outputPath}`);
  console.log(`Total : ${challenges.length} défis.`);
}

main();
