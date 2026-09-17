// ============================================================
// GÉNÉRATEUR DE DÉFIS
// Génère des défis avec solution unique pré-calculée.
// Étape 1 : solution complète aléatoire valide
// Étape 2 : retrait itératif de jetons jusqu'à unicité
// Étape 3 : validation qualité
// ============================================================

import { BoardDefinition } from '../models/Board';
import { ElementDefinition } from '../models/Element';
import { Challenge, DifficultyLevel, FixedPlacement, TokenCount } from '../models/Challenge';
import { solve } from '../engine/solver';
import { LEVEL_PARAMS } from '../../constants/difficulty';

export interface GeneratorOptions {
  boardId: string;
  boardDef: BoardDefinition;
  elementDefs: Record<string, ElementDefinition>;
  difficulty: DifficultyLevel;
  seed?: number;
}

export interface ChallengeQuality {
  isUnique: boolean;
  difficulty: DifficultyLevel;
  estimatedDuration: number;
  isBalanced: boolean;
}

/**
 * Point d'entrée principal : génère un défi complet avec solution unique.
 * Effectue jusqu'à MAX_ATTEMPTS tentatives pour garantir la validité.
 */
const MAX_ATTEMPTS = 40;

export function generateChallenge(options: GeneratorOptions): Challenge | null {
  const { boardDef, elementDefs, difficulty, boardId } = options;
  const params = LEVEL_PARAMS[difficulty];
  if (!params) return null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Choisir une composition aléatoire parmi celles du niveau
    const composition = params.compositions[
      Math.floor(Math.random() * params.compositions.length)
    ];

    // Construire l'inventaire de jetons depuis la composition
    const tokenCounts: TokenCount[] = Object.entries(composition)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([elementId, count]) => ({ elementId, count: count! }));

    // Étape 1 : Générer une solution complète valide
    const solution = generateValidSolution(boardDef, elementDefs, tokenCounts);
    if (!solution) continue;

    // Étape 2 : Créer le défi en retirant des jetons
    const [minEmpty, maxEmpty] = params.emptyCellsRange;
    const targetEmptyCells = minEmpty + Math.floor(Math.random() * (maxEmpty - minEmpty + 1));
    const { fixedPlacements, availableTokens } = createChallengeFromSolution(
      solution,
      targetEmptyCells,
      boardDef,
      elementDefs,
      tokenCounts
    );

    // Rejeter si le nombre de cases vides cible n'est pas atteint
    const actualEmpty = boardDef.cellCount - fixedPlacements.length;
    if (actualEmpty < targetEmptyCells) continue;

    // Vérifier l'unicité finale (isUnique = false si 0 ou 2+ solutions)
    const solverResult = solve({ boardDef, fixedPlacements, availableTokens, elementDefs });
    if (!solverResult.isUnique) continue;

    // Vérifier la validité pédagogique (éléments relationnels jouables)
    if (!isPedagogicallyValid(availableTokens, tokenCounts)) continue;

    const estimatedDuration = estimateDuration(fixedPlacements.length, boardDef.cellCount, difficulty);

    return {
      id: `${difficulty}_${Date.now()}`,
      boardId,
      level: difficulty,
      levelNumber: 1,
      challengeNumber: 1,
      fixedPlacements,
      availableTokens,
      solution,
      solutionCount: 1,
      estimatedDuration,
      createdAt: new Date().toISOString(),
    };
  }

  return null; // Échec après MAX_ATTEMPTS tentatives
}

/**
 * Vérifie que le défi est pédagogiquement valide :
 * chaque élément à contrainte relationnelle doit avoir au moins 1 jeton à poser.
 */
function isPedagogicallyValid(
  availableTokens: TokenCount[],
  fullTokens: TokenCount[]
): boolean {
  const availableIds = new Set(availableTokens.map(t => t.elementId));
  const inFull = (id: string) => fullTokens.some(t => t.elementId === id);

  if (inFull('chien') && !availableIds.has('chien')) return false;
  if (inFull('chalet') && !availableIds.has('chalet') && !availableIds.has('bucheron')) return false;
  if (inFull('renard') && !availableIds.has('renard') && !availableIds.has('mouton')) return false;

  return true;
}

/**
 * Étape 1 : Génère une solution complète valide aléatoirement.
 * Utilise le solveur avec un plateau vide pour trouver une solution.
 */
function generateValidSolution(
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>,
  tokenCounts: TokenCount[]
): string[] | null {
  const result = solve({
    boardDef,
    fixedPlacements: [],
    availableTokens: tokenCounts,
    elementDefs,
  });

  if (result.solutions.length === 0) return null;

  // Choisir une solution aléatoire parmi celles trouvées
  const randomIdx = Math.floor(Math.random() * result.solutions.length);
  return result.solutions[randomIdx];
}

/**
 * Étape 2 : Retire des jetons de la solution jusqu'à atteindre
 * le nombre de cases vides cible, en garantissant l'unicité.
 */
function createChallengeFromSolution(
  solution: string[],
  targetEmptyCells: number,
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>,
  tokenCounts: TokenCount[]
): { fixedPlacements: FixedPlacement[]; availableTokens: TokenCount[] } {
  // Partir de la solution complète comme jetons fixes
  let fixedPlacements: FixedPlacement[] = solution.map((elementId, cellIndex) => ({
    cellIndex,
    elementId,
  }));

  // Indices des cases qu'on peut essayer de retirer (ordre aléatoire)
  const indices = shuffleArray([...Array(solution.length).keys()]);
  let emptyCellCount = 0;

  for (const idx of indices) {
    if (emptyCellCount >= targetEmptyCells) break;

    // Retirer temporairement ce jeton
    const newFixed = fixedPlacements.filter(fp => fp.cellIndex !== idx);

    // Calculer les jetons disponibles pour les cases vides
    const available = computeAvailableTokens(solution, newFixed, tokenCounts);

    // Vérifier que la solution reste unique
    const result = solve({
      boardDef,
      fixedPlacements: newFixed,
      availableTokens: available,
      elementDefs,
    });

    if (result.isUnique) {
      fixedPlacements = newFixed;
      emptyCellCount++;
    }
    // Sinon, on garde ce jeton fixe et on essaie le suivant
  }

  const availableTokens = computeAvailableTokens(solution, fixedPlacements, tokenCounts);

  return { fixedPlacements, availableTokens };
}

/**
 * Calcule les jetons disponibles pour le joueur
 * (solution - jetons fixes).
 */
function computeAvailableTokens(
  solution: string[],
  fixedPlacements: FixedPlacement[],
  _tokenCounts: TokenCount[]
): TokenCount[] {
  const fixedSet = new Set(fixedPlacements.map(fp => fp.cellIndex));
  const counts: Record<string, number> = {};

  for (let i = 0; i < solution.length; i++) {
    if (!fixedSet.has(i)) {
      const el = solution[i];
      counts[el] = (counts[el] ?? 0) + 1;
    }
  }

  return Object.entries(counts).map(([elementId, count]) => ({ elementId, count }));
}

function estimateDuration(
  fixedCount: number,
  totalCells: number,
  difficulty: DifficultyLevel
): number {
  const params = LEVEL_PARAMS[difficulty];
  if (!params) return 300;
  const [min, max] = params.estimatedDurationRange;
  return Math.round((min + max) / 2);
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
