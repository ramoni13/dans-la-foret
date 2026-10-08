// ============================================================
// GÉNÉRATEUR DE VIEWER_DATA.js
// Lit tous les fichiers JSON de défis et produit un fichier JS
// chargeable via <script src="VIEWER_DATA.js"> dans VIEWER_DEFIS.html.
//
// Inclut les défis journaliers (30 jours) avec vérification
// d'unicité à chaque niveau joueur.
//
// Usage : npm run generate:viewer
// Sortie : VIEWER_DATA.js (à la racine de dans-la-foret-app/)
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';
import { FixedPlacement, TokenCount } from '../src/core/models/Challenge';
import { Composition } from '../src/constants/difficulty';
import { solve, RngFunction } from '../src/core/engine/solver';

// ── Niveaux classiques ───────────────────────────────────────────────────────

const LEVELS = [
  'niveau_1', 'niveau_2', 'niveau_3', 'niveau_4', 'niveau_5',
  'niveau_6', 'niveau_7', 'niveau_8', 'niveau_9', 'niveau_10',
  'niveau_11', 'niveau_12', 'niveau_13', 'niveau_14', 'niveau_15',
];

const CHALLENGES_DIR = path.resolve(__dirname, '../src/data/challenges');
const OUTPUT_FILE    = path.resolve(__dirname, '../VIEWER_DATA.js');

// ── Éléments SANS require() d'assets ─────────────────────────────────────────

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

// ── Board 15 daily SANS require() d'assets ───────────────────────────────────

const board15cellsDaily: BoardDefinition = {
  id: 'board_15_daily', label: 'Clairière Secrète', cellCount: 15,
  connections: [
    [1, 3, 5], [0, 2, 7], [1, 4, 6], [0, 5, 7, 10], [2, 6, 7, 11],
    [0, 3, 8], [2, 4, 9], [1, 3, 4, 10, 11, 13], [5, 10, 12], [6, 11, 14],
    [3, 7, 8, 12], [4, 7, 9, 14], [8, 10, 13], [7, 12, 14], [9, 11, 13],
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

// ── PRNG déterministe — Mulberry32 ───────────────────────────────────────────

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

// ── Compositions daily (copie exacte de dailyChallengeService.ts) ────────────

const DAILY_COMPOSITIONS: Composition[] = [
  { bucheron: 3, ours: 2, mouton: 3, chien: 2, Loup: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 4, ours: 2, mouton: 2, chien: 2, Loup: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 2, ours: 2, mouton: 4, chien: 2, Loup: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 2, ours: 2, mouton: 2, chien: 3, Loup: 1, cerf: 1, biche: 1, ruche: 1, champignon: 2 },
  { bucheron: 3, ours: 2, mouton: 2, chien: 2, ruche: 1, Loup: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 2, ours: 2, mouton: 3, chien: 2, ruche: 1, Loup: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 3, ours: 2, mouton: 2, chien: 2, chalet: 1, Loup: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 3, ours: 1, mouton: 2, chien: 3, chalet: 1, Loup: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 3, ours: 2, mouton: 2, chien: 3, tas_buches: 1, Loup: 1, cerf: 1, biche: 1, champignon: 1 },
  { bucheron: 3, ours: 1, mouton: 3, chien: 2, tas_buches: 1, Loup: 1, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 3, ours: 2, mouton: 1, chien: 2, chalet: 1, Loup: 1, cerf: 1, biche: 1, tas_buches: 1, champignon: 2 },
  { bucheron: 3, ours: 2, mouton: 1, chien: 2, chalet: 1, Loup: 1, cerf: 1, biche: 1, tas_buches: 1, ruche: 1, champignon: 1 },
  { bucheron: 3, ours: 2, mouton: 1, chien: 2, Loup: 1, cerf: 2, biche: 2, champignon: 2 },
  { bucheron: 2, ours: 2, mouton: 1, chien: 2, Loup: 1, cerf: 3, biche: 3, champignon: 1 },
  { bucheron: 2, ours: 2, mouton: 3, chien: 2, Loup: 2, cerf: 1, biche: 1, champignon: 2 },
  { bucheron: 2, ours: 1, mouton: 4, chien: 2, Loup: 2, cerf: 1, biche: 1, champignon: 2 },
];

const TARGET_MAX_FIXED = 6;
const ATTEMPTS_PER_COMPOSITION = 5;
const MIN_FIXED_COUNT = 4;
const MAX_FIXED_COUNT = 9;

// ── Fonctions pédagogiques / narratives ──────────────────────────────────────

function isDailyPedagogicallyValid(availableTokens: TokenCount[], fullTokens: TokenCount[]): boolean {
  const availableMap = new Map(availableTokens.map(t => [t.elementId, t.count]));
  const fullMap = new Map(fullTokens.map(t => [t.elementId, t.count]));
  const inFull = (id: string) => (fullMap.get(id) ?? 0) > 0;
  const hasAvailable = (id: string) => (availableMap.get(id) ?? 0) > 0;
  if (availableTokens.length === 0 || availableTokens.every(t => t.count === 0)) return false;
  if (inFull('chalet') && !hasAvailable('chalet') && !hasAvailable('bucheron')) return false;
  if (inFull('loup') && !hasAvailable('loup') && !hasAvailable('mouton')) return false;
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
  if (inCompo('loup') && !inCompo('mouton')) return false;
  if (inCompo('chalet') && !inCompo('bucheron')) return false;
  if (inCompo('tas_buches') && !inCompo('bucheron')) return false;
  return true;
}

function isDailyNarrativelyInteresting(availableTokens: TokenCount[], fullTokenCounts: TokenCount[]): boolean {
  const inCompo = (id: string) => fullTokenCounts.some(t => t.elementId === id && t.count > 0);
  const hasAvailable = (id: string) => availableTokens.some(t => t.elementId === id && t.count > 0);
  if (inCompo('loup') && inCompo('mouton')) {
    if (!hasAvailable('loup') && !hasAvailable('mouton')) return false;
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
  solution: string[], fixedPlacements: FixedPlacement[], fullTokens: TokenCount[]
): TokenCount[] {
  const fixedCounts: Record<string, number> = {};
  for (const fp of fixedPlacements) {
    fixedCounts[fp.elementId] = (fixedCounts[fp.elementId] ?? 0) + 1;
  }
  return fullTokens
    .map(t => ({ elementId: t.elementId, count: t.count - (fixedCounts[t.elementId] ?? 0) }))
    .filter(t => t.count > 0);
}

// ── Adaptation par niveau joueur (copie de dailyChallengeService.ts) ─────────

function getPlayerFixedCount(playerLevel: number): number {
  if (playerLevel >= 10) return MIN_FIXED_COUNT;
  if (playerLevel >= 8) return 5;
  if (playerLevel >= 6) return 6;
  if (playerLevel >= 4) return 7;
  if (playerLevel >= 2) return 8;
  return MAX_FIXED_COUNT;
}

// ── Interfaces pour les données du viewer ────────────────────────────────────

interface DailyViewerData {
  date: string;
  compositionIndex: number;
  baseFixedCount: number;
  solution: string[];
  fixedOrder: number[];
  /** Défi vu par chaque palier de niveau joueur */
  perLevel: DailyPerLevelData[];
  /** Vérification d'unicité réussie à chaque niveau */
  allUnique: boolean;
}

interface DailyPerLevelData {
  playerLevelMin: number;
  playerLevelMax: number;
  fixedCount: number;
  emptyCells: number;
  fixedPlacements: FixedPlacement[];
  availableTokens: TokenCount[];
  solutionCount: number;
  isUnique: boolean;
  pedagogicallyValid: boolean;
  narrativelyInteresting: boolean;
}

// ── Générateur daily ─────────────────────────────────────────────────────────

function generateDailyForViewer(date: Date): DailyViewerData | null {
  const seed = dateSeed(date);
  const rng = mulberry32(seed);
  const boardDef = board15cellsDaily;

  const compositionOrder = seededShuffle(
    DAILY_COMPOSITIONS.map((_, i) => i),
    rng
  );

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
    if (!isDailyNarrativelyCoherent(fullTokens)) continue;

    for (let attempt = 0; attempt < ATTEMPTS_PER_COMPOSITION; attempt++) {
      const attemptSeed = seed + compIndex * 7919 + attempt * 13;
      const attemptRng = mulberry32(attemptSeed);

      const solverResult = solve({
        boardDef, fixedPlacements: [], availableTokens: fullTokens,
        elementDefs, rng: attemptRng,
      });
      if (solverResult.solutionCount === 0) continue;

      const solution = solverResult.solutions[0];

      // Retrait itératif
      const strategyRng = mulberry32(attemptSeed + 31);
      const removalOrder = getDailyRemovalStrategy(attempt, boardDef, strategyRng);

      let fixedPlacements: FixedPlacement[] = solution.map((elementId, cellIndex) => ({
        cellIndex, elementId,
      }));
      let emptyCellCount = 0;
      const removedOrder: number[] = [];

      for (const idx of removalOrder) {
        const newFixed = fixedPlacements.filter(fp => fp.cellIndex !== idx);
        const available = computeDailyAvailableTokens(solution, newFixed, fullTokens);
        const checkRng = mulberry32(attemptSeed + idx * 37);
        const checkResult = solve({
          boardDef, fixedPlacements: newFixed, availableTokens: available,
          elementDefs, rng: checkRng,
        });
        if (checkResult.isUnique) {
          fixedPlacements = newFixed;
          emptyCellCount++;
          removedOrder.push(idx);
        }
      }

      const actualFixedCount = boardDef.cellCount - emptyCellCount;
      if (actualFixedCount > TARGET_MAX_FIXED) continue;

      const availableTokens = computeDailyAvailableTokens(solution, fixedPlacements, fullTokens);
      if (!isDailyPedagogicallyValid(availableTokens, fullTokens)) continue;
      if (!isDailyNarrativelyInteresting(availableTokens, fullTokens)) continue;

      // Construire fixedOrder
      const fixedIndices = fixedPlacements.map(fp => fp.cellIndex);
      const removedReversed = [...removedOrder].reverse();
      const fixedOrder = [...fixedIndices, ...removedReversed];

      // Vérifier l'unicité pour chaque palier de niveau joueur
      const PLAYER_LEVEL_RANGES = [
        { min: 10, max: 15 },
        { min: 8,  max: 9  },
        { min: 6,  max: 7  },
        { min: 4,  max: 5  },
        { min: 2,  max: 3  },
        { min: 1,  max: 1  },
      ];

      const perLevel: DailyPerLevelData[] = [];
      let allUnique = true;

      for (const range of PLAYER_LEVEL_RANGES) {
        const targetFixed = Math.max(getPlayerFixedCount(range.min), actualFixedCount);
        const levelFixedPlacements: FixedPlacement[] = fixedOrder
          .slice(0, targetFixed)
          .map(cellIndex => ({ cellIndex, elementId: solution[cellIndex] }));
        const levelAvailable = computeDailyAvailableTokens(solution, levelFixedPlacements, fullTokens);

        // Vérifier unicité
        const uniqueCheck = solve({
          boardDef, fixedPlacements: levelFixedPlacements,
          availableTokens: levelAvailable, elementDefs,
        });

        const levelData: DailyPerLevelData = {
          playerLevelMin: range.min,
          playerLevelMax: range.max,
          fixedCount: targetFixed,
          emptyCells: boardDef.cellCount - targetFixed,
          fixedPlacements: levelFixedPlacements,
          availableTokens: levelAvailable,
          solutionCount: uniqueCheck.solutionCount,
          isUnique: uniqueCheck.isUnique,
          pedagogicallyValid: isDailyPedagogicallyValid(levelAvailable, fullTokens),
          narrativelyInteresting: isDailyNarrativelyInteresting(levelAvailable, fullTokens),
        };
        perLevel.push(levelData);
        if (!uniqueCheck.isUnique) allUnique = false;
      }

      const dateStr = date.toISOString().split('T')[0];
      return {
        date: dateStr,
        compositionIndex: compIndex,
        baseFixedCount: actualFixedCount,
        solution,
        fixedOrder,
        perLevel,
        allUnique,
      };
    }
  }

  return null;
}

// ── Génération principale ────────────────────────────────────────────────────

function generate() {
  console.log('Génération de VIEWER_DATA.js...\n');

  // 1. Niveaux classiques
  console.log('── Niveaux classiques ──');
  const parts: string[] = [];
  let totalChallenges = 0;

  for (const level of LEVELS) {
    const filePath = path.join(CHALLENGES_DIR, `${level}.json`);

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️  ${level}.json introuvable — niveau ignoré`);
      parts.push(`  '${level}': { "challenges": [] }`);
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf-8').trim();

    try {
      const parsed = JSON.parse(raw);
      const count = parsed.challenges?.length ?? 0;
      totalChallenges += count;
      console.log(`  ✓ ${level} — ${count} défis`);
    } catch {
      console.error(`  ✗ ${level}.json invalide — niveau ignoré`);
      parts.push(`  '${level}': { "challenges": [] }`);
      continue;
    }

    parts.push(`  '${level}': ${raw}`);
  }

  // 2. Défis journaliers (30 jours à partir d'aujourd'hui)
  console.log('\n── Défis journaliers ──');
  const DAILY_DAYS = 30;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const dailyChallenges: DailyViewerData[] = [];
  let dailySuccess = 0;
  let dailyAllUnique = 0;

  for (let day = 0; day < DAILY_DAYS; day++) {
    const date = new Date(today.getTime() + day * 86400000);
    const result = generateDailyForViewer(date);
    if (result) {
      dailyChallenges.push(result);
      dailySuccess++;
      if (result.allUnique) dailyAllUnique++;
      const dateStr = result.date;
      const uniqueStr = result.allUnique ? '✓ unique tous niveaux' : '⚠ pas unique certains niveaux';
      console.log(`  ✓ ${dateStr} | compo #${result.compositionIndex} | ${result.baseFixedCount} fixes | ${uniqueStr}`);
    } else {
      const dateStr = date.toISOString().split('T')[0];
      console.log(`  ✗ ${dateStr} | ÉCHEC`);
    }
  }

  // 3. Assembler le fichier
  parts.push(`  'daily_challenges': ${JSON.stringify(dailyChallenges, null, 2)}`);

  const output = [
    '// ============================================================',
    '// VIEWER_DATA.js — Généré automatiquement par generateViewerData.ts',
    `// Date : ${new Date().toISOString()}`,
    `// Total : ${totalChallenges} défis classiques sur ${LEVELS.length} niveaux`,
    `//         ${dailySuccess} défis journaliers (${dailyAllUnique} avec unicité vérifiée tous niveaux)`,
    '// NE PAS MODIFIER MANUELLEMENT — relancer : npm run generate:viewer',
    '// ============================================================',
    '',
    '/* global ALL_DATA */',
    'const ALL_DATA = {',
    parts.join(',\n'),
    '};',
    '',
  ].join('\n');

  // Écriture robuste : temp file + rename avec retry si le fichier est verrouillé
  const tmpFile = OUTPUT_FILE + '.tmp';
  fs.writeFileSync(tmpFile, output, 'utf-8');
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Supprimer l'ancien fichier s'il existe (libère le nom)
      if (fs.existsSync(OUTPUT_FILE)) {
        fs.unlinkSync(OUTPUT_FILE);
      }
      fs.renameSync(tmpFile, OUTPUT_FILE);
      break;
    } catch (err: any) {
      if (attempt === maxRetries) {
        // Dernier recours : copier le contenu directement
        try {
          fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
          fs.unlinkSync(tmpFile);
        } catch {
          console.error(`\n❌ Impossible d'écrire ${OUTPUT_FILE} — le fichier est verrouillé par un autre processus.`);
          console.error(`   Fermez VIEWER_DEFIS.html dans le navigateur puis relancez la commande.`);
          console.error(`   Le fichier temporaire est disponible : ${tmpFile}`);
          process.exit(1);
        }
      } else {
        console.warn(`⏳ Fichier verrouillé, tentative ${attempt}/${maxRetries}… (attente 1s)`);
        // Attente synchrone 1 seconde
        const waitUntil = Date.now() + 1000;
        while (Date.now() < waitUntil) { /* busy wait */ }
      }
    }
  }
  console.log(`\n✅ VIEWER_DATA.js généré — ${totalChallenges} classiques + ${dailySuccess} journaliers, ${(output.length / 1024).toFixed(0)} Ko`);
  console.log(`   → ${OUTPUT_FILE}`);
}

generate();
