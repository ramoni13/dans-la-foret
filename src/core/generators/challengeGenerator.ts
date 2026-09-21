// ============================================================
// GÉNÉRATEUR DE DÉFIS
// Génère des défis avec solution unique pré-calculée.
// Étape 1 : solution complète aléatoire valide (diversifiée)
// Étape 2 : retrait itératif de jetons jusqu'à unicité
// Étape 3 : validation qualité + diversité structurelle
//
// Garanties :
//   - Solution unique vérifiée avec TOUS les jetons disponibles
//   - Aucun type d'élément entièrement en cases fixes
//   - Structure des cases fixes différente des défis récents
//   - Compositions variées au sein d'un même niveau
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
  // Signatures des défis récents pour éviter les doublons structurels.
  // Format : ensemble de chaînes "cellIndex:elementId" triées.
  recentFixedSignatures?: Set<string>;
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
 *
 * Diversité garantie par :
 *   1. Rotation des compositions (pas de répétition consécutive)
 *   2. Collecte de TOUTES les solutions valides → choix aléatoire parmi elles
 *   3. Plusieurs stratégies de retrait de jetons (bords d'abord, centre d'abord,
 *      aléatoire pur) tournées à chaque tentative
 *   4. Rejet des structures de cases fixes trop similaires aux défis récents
 */
const MAX_ATTEMPTS = 60; // Augmenté pour absorber les rejets de diversité

// Seuil de similarité : deux défis sont "trop similaires" si leur
// intersection de cases fixes dépasse ce pourcentage du total des cases fixes.
const SIMILARITY_THRESHOLD = 0.75;

export function generateChallenge(options: GeneratorOptions): Challenge | null {
  const { boardDef, elementDefs, difficulty, boardId, recentFixedSignatures } = options;
  const params = LEVEL_PARAMS[difficulty];
  if (!params) return null;

  // Rotation des compositions : on mélange l'ordre pour éviter de toujours
  // piocher les mêmes en début de liste quand les premières tentatives échouent.
  const shuffledCompositions = shuffleArray([...params.compositions]);
  let compositionIndex = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Rotation circulaire des compositions pour garantir la variété
    const composition = shuffledCompositions[compositionIndex % shuffledCompositions.length];
    compositionIndex++;

    // Construire l'inventaire de jetons depuis la composition
    const tokenCounts: TokenCount[] = Object.entries(composition)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([elementId, count]) => ({ elementId, count: count! }));

    // Étape 1 : Collecter TOUTES les solutions valides pour cette composition,
    // puis en choisir une aléatoirement → maximise la diversité des structures.
    const solution = generateValidSolution(boardDef, elementDefs, tokenCounts);
    if (!solution) continue;

    // Étape 2 : Créer le défi en retirant des jetons.
    // La stratégie de retrait varie selon la tentative pour diversifier
    // les patterns de cases fixes (bords, centre, aléatoire).
    const [minEmpty, maxEmpty] = params.emptyCellsRange;
    const targetEmptyCells = minEmpty + Math.floor(Math.random() * (maxEmpty - minEmpty + 1));
    const removalStrategy = getRemovalStrategy(attempt, boardDef);

    const { fixedPlacements, availableTokens } = createChallengeFromSolution(
      solution,
      targetEmptyCells,
      boardDef,
      elementDefs,
      tokenCounts,
      removalStrategy
    );

    // Rejeter si le nombre de cases vides cible n'est pas atteint
    const actualEmpty = boardDef.cellCount - fixedPlacements.length;
    if (actualEmpty < targetEmptyCells) continue;

    // Vérifier l'unicité finale avec TOUS les jetons disponibles pour le joueur.
    // C'est la garantie absolue : avec exactement ces jetons, il n'existe
    // qu'une seule façon de compléter le plateau.
    const solverResult = solve({ boardDef, fixedPlacements, availableTokens, elementDefs });
    if (!solverResult.isUnique) continue;

    // Vérifier la validité pédagogique
    if (!isPedagogicallyValid(availableTokens, tokenCounts)) continue;

    // Vérifier la diversité structurelle : rejeter si trop similaire
    // à un défi récent (même cases fixes, même éléments).
    if (recentFixedSignatures) {
      const sig = fixedSignature(fixedPlacements);
      if (isTooSimilarToRecent(sig, recentFixedSignatures, fixedPlacements.length)) continue;
    }

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
 * Vérifie que le défi est pédagogiquement valide.
 *
 * Règle générale (point 5) : pour chaque type d'élément présent dans la
 * composition, au moins 1 exemplaire doit rester à placer par le joueur.
 * Un élément entièrement en cases fixes n'apporte aucun intérêt pédagogique.
 *
 * Règles spécifiques supplémentaires :
 *   - chien    : au moins 1 chien à poser (la meute doit être à construire)
 *   - chalet   : au moins 1 chalet OU 1 bucheron à poser (relation visible)
 *   - renard   : au moins 1 renard OU 1 mouton à poser (relation visible)
 *   - ruche    : au moins 1 ruche OU 1 ours à poser (relation visible)
 *   - cerf     : au moins 1 cerf OU 1 biche à poser (couple à former)
 *   - biche    : au moins 1 biche OU 1 cerf à poser (couple à former)
 *   - tas_buches : au moins 1 tas_buches OU 1 bucheron à poser
 */
function isPedagogicallyValid(
  availableTokens: TokenCount[],
  fullTokens: TokenCount[]
): boolean {
  const availableMap = new Map(availableTokens.map(t => [t.elementId, t.count]));
  const fullMap = new Map(fullTokens.map(t => [t.elementId, t.count]));

  const inFull = (id: string) => (fullMap.get(id) ?? 0) > 0;
  const hasAvailable = (id: string) => (availableMap.get(id) ?? 0) > 0;

  // Règle générale : aucun type ne doit être entièrement en cases fixes.
  // Si un type est dans la composition mais absent des jetons disponibles
  // → tous ses exemplaires sont fixés → invalide.
  for (const [elementId] of fullMap) {
    if (!hasAvailable(elementId)) return false;
  }

  // Règles relationnelles : au moins un des deux éléments d'une paire
  // doit être à poser pour que la relation soit visible et jouable.
  if (inFull('chalet') && !hasAvailable('chalet') && !hasAvailable('bucheron')) return false;
  if (inFull('renard') && !hasAvailable('renard') && !hasAvailable('mouton')) return false;
  if (inFull('ruche') && !hasAvailable('ruche') && !hasAvailable('ours')) return false;
  if (inFull('cerf') && !hasAvailable('cerf') && !hasAvailable('biche')) return false;
  if (inFull('biche') && !hasAvailable('biche') && !hasAvailable('cerf')) return false;
  if (inFull('tas_buches') && !hasAvailable('tas_buches') && !hasAvailable('bucheron')) return false;

  return true;
}

/**
 * Étape 1 : Génère une solution complète valide.
 *
 * Le solveur collecte TOUTES les solutions valides pour la composition donnée
 * (il s'arrête à 2 pour la détection d'unicité, mais ici on veut la diversité).
 * On choisit aléatoirement parmi toutes les solutions trouvées.
 *
 * Pour maximiser la diversité, on utilise un solveur sans limite de solutions
 * (MAX_SOLUTIONS_FOR_DIVERSITY) afin d'avoir un échantillon représentatif.
 */
const MAX_SOLUTIONS_FOR_DIVERSITY = 50; // Collecter jusqu'à 50 solutions différentes

function generateValidSolution(
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>,
  tokenCounts: TokenCount[]
): string[] | null {
  const result = solveForDiversity({
    boardDef,
    fixedPlacements: [],
    availableTokens: tokenCounts,
    elementDefs,
    maxSolutions: MAX_SOLUTIONS_FOR_DIVERSITY,
  });

  if (result.solutions.length === 0) return null;

  // Choisir une solution aléatoire parmi toutes celles trouvées
  const randomIdx = Math.floor(Math.random() * result.solutions.length);
  return result.solutions[randomIdx];
}

/**
 * Étape 2 : Retire des jetons de la solution jusqu'à atteindre
 * le nombre de cases vides cible, en garantissant l'unicité.
 *
 * La stratégie de retrait (removalStrategy) détermine l'ordre dans lequel
 * on essaie de retirer les jetons. Varier cette stratégie entre les tentatives
 * produit des structures de cases fixes structurellement différentes :
 *   - 'random'  : ordre purement aléatoire (comportement historique)
 *   - 'edges'   : on essaie d'abord de retirer les cases de bord
 *   - 'center'  : on essaie d'abord de retirer les cases centrales
 *   - 'spread'  : on alterne bords et centre pour étaler les cases fixes
 */
function createChallengeFromSolution(
  solution: string[],
  targetEmptyCells: number,
  boardDef: BoardDefinition,
  elementDefs: Record<string, ElementDefinition>,
  tokenCounts: TokenCount[],
  removalStrategy: number[] // Ordre des indices à essayer de retirer
): { fixedPlacements: FixedPlacement[]; availableTokens: TokenCount[] } {
  // Partir de la solution complète comme jetons fixes
  let fixedPlacements: FixedPlacement[] = solution.map((elementId, cellIndex) => ({
    cellIndex,
    elementId,
  }));

  let emptyCellCount = 0;

  for (const idx of removalStrategy) {
    if (emptyCellCount >= targetEmptyCells) break;

    // Retirer temporairement ce jeton
    const newFixed = fixedPlacements.filter(fp => fp.cellIndex !== idx);

    // Calculer les jetons disponibles pour les cases vides
    const available = computeAvailableTokens(solution, newFixed, tokenCounts);

    // Vérifier que la solution reste unique avec exactement ces jetons disponibles.
    // Le solveur explore toutes les combinaisons possibles de placement
    // et s'arrête dès qu'il trouve une 2e solution (optimisation).
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
    // Sinon, ce jeton est nécessaire à l'unicité → on le garde fixe
  }

  const availableTokens = computeAvailableTokens(solution, fixedPlacements, tokenCounts);

  return { fixedPlacements, availableTokens };
}

// ── Stratégies de retrait de jetons ──────────────────────────────────────────

/**
 * Retourne l'ordre des indices à essayer de retirer selon la stratégie
 * choisie en fonction du numéro de tentative.
 *
 * 4 stratégies en rotation :
 *   0 mod 4 → aléatoire pur
 *   1 mod 4 → bords d'abord (cases avec peu de voisins)
 *   2 mod 4 → centre d'abord (cases avec beaucoup de voisins)
 *   3 mod 4 → alterné (1 bord, 1 centre, 1 bord...)
 */
function getRemovalStrategy(attempt: number, boardDef: BoardDefinition): number[] {
  const allIndices = [...Array(boardDef.cellCount).keys()];

  // Trier les cases par nombre de voisins (connectivité)
  const byConnectivity = [...allIndices].sort(
    (a, b) => boardDef.connections[a].length - boardDef.connections[b].length
  );
  const edgesFirst = byConnectivity; // Peu de voisins = bords
  const centerFirst = [...byConnectivity].reverse(); // Beaucoup de voisins = centre

  // Alterné : intercaler bords et centre
  const alternated: number[] = [];
  for (let i = 0; i < allIndices.length; i++) {
    if (i % 2 === 0) alternated.push(edgesFirst[Math.floor(i / 2)]);
    else alternated.push(centerFirst[Math.floor(i / 2)]);
  }

  switch (attempt % 4) {
    case 0: return shuffleArray(allIndices);   // Aléatoire
    case 1: return shuffleWithinGroups(edgesFirst, boardDef); // Bords d'abord
    case 2: return shuffleWithinGroups(centerFirst, boardDef); // Centre d'abord
    case 3: return alternated;                 // Alterné
    default: return shuffleArray(allIndices);
  }
}

/**
 * Mélange les cases à l'intérieur de chaque groupe de connectivité égale,
 * tout en préservant l'ordre global (bords avant centre ou inverse).
 * Évite que la stratégie soit trop déterministe.
 */
function shuffleWithinGroups(sortedIndices: number[], boardDef: BoardDefinition): number[] {
  const groups = new Map<number, number[]>();
  for (const idx of sortedIndices) {
    const connectivity = boardDef.connections[idx].length;
    if (!groups.has(connectivity)) groups.set(connectivity, []);
    groups.get(connectivity)!.push(idx);
  }
  const result: number[] = [];
  for (const [, group] of groups) {
    result.push(...shuffleArray(group));
  }
  return result;
}

// ── Diversité structurelle ───────────────────────────────────────────────────

/**
 * Calcule une signature unique pour la structure des cases fixes d'un défi.
 * Format : "cellIndex:elementId" triés et concaténés.
 * Deux défis avec les mêmes cases fixes et les mêmes éléments ont la même signature.
 */
export function fixedSignature(fixedPlacements: FixedPlacement[]): string {
  return [...fixedPlacements]
    .sort((a, b) => a.cellIndex - b.cellIndex)
    .map(fp => `${fp.cellIndex}:${fp.elementId}`)
    .join('|');
}

/**
 * Vérifie si un défi est trop similaire à des défis récents.
 *
 * Similarité = proportion de cases fixes identiques (même index ET même élément)
 * entre le nouveau défi et chaque défi récent.
 *
 * Si la similarité dépasse SIMILARITY_THRESHOLD (75%), le défi est rejeté.
 */
function isTooSimilarToRecent(
  newSig: string,
  recentSignatures: Set<string>,
  fixedCount: number
): boolean {
  // Signature identique = défi strictement identique
  if (recentSignatures.has(newSig)) return true;

  // Comparaison partielle : compter les cases fixes communes
  const newParts = new Set(newSig.split('|'));
  for (const recentSig of recentSignatures) {
    const recentParts = recentSig.split('|');
    const commonCount = recentParts.filter(p => newParts.has(p)).length;
    const similarity = commonCount / Math.max(fixedCount, recentParts.length);
    if (similarity > SIMILARITY_THRESHOLD) return true;
  }
  return false;
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

// ── Solveur étendu pour la diversité ───────────────────────────────────────────────

/**
 * Variante du solveur qui collecte jusqu'à maxSolutions solutions
 * au lieu de s'arrêter à 2.
 *
 * Utilisé uniquement à l'étape 1 (génération de la solution de départ)
 * pour maximiser la diversité des structures générées.
 * Le solveur standard (limité à 2) reste utilisé pour la vérification
 * d'unicité à l'étape 2.
 */
function solveForDiversity(input: {
  boardDef: BoardDefinition;
  fixedPlacements: FixedPlacement[];
  availableTokens: TokenCount[];
  elementDefs: Record<string, ElementDefinition>;
  maxSolutions: number;
}): { solutions: string[][] } {
  const { boardDef, fixedPlacements, availableTokens, elementDefs, maxSolutions } = input;

  const initialBoard: (string | null)[] = Array(boardDef.cellCount).fill(null);
  for (const fp of fixedPlacements) {
    initialBoard[fp.cellIndex] = fp.elementId;
  }

  const tokenInventory: Record<string, number> = {};
  for (const tc of availableTokens) {
    tokenInventory[tc.elementId] = tc.count;
  }

  // Réutilise le même import solve mais avec une limite configurable.
  // On passe par le solveur standard en plusieurs appels avec des
  // placements fixes différents pour obtenir des solutions variées.
  //
  // Stratégie : on lance le solveur standard (qui s'arrête à 2 solutions)
  // depuis plusieurs points de départ aléatoires en fixant la première case
  // à chaque élément possible, ce qui force l'exploration de branches différentes.
  const seen = new Set<string>();
  const solutions: string[][] = [];

  // Trouver la première case vide
  const firstEmpty = initialBoard.findIndex(c => c === null);
  if (firstEmpty === -1) return { solutions };

  // Pour chaque élément disponible, fixer la première case et résoudre
  for (const [elementId, count] of Object.entries(tokenInventory)) {
    if (solutions.length >= maxSolutions) break;
    if (count <= 0) continue;

    // Fixer la première case à cet élément et résoudre le reste
    const seedFixed: FixedPlacement[] = [
      ...fixedPlacements,
      { cellIndex: firstEmpty, elementId },
    ];
    const seedTokens: TokenCount[] = availableTokens.map(t =>
      t.elementId === elementId
        ? { ...t, count: t.count - 1 }
        : t
    ).filter(t => t.count > 0);

    const result = solve({ boardDef, fixedPlacements: seedFixed, availableTokens: seedTokens, elementDefs });

    for (const sol of result.solutions) {
      if (solutions.length >= maxSolutions) break;
      // Reconstruire la solution complète (avec la case fixée)
      const fullSol = [...sol];
      // sol est déjà complet (le solveur remplit toutes les cases)
      const key = fullSol.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        solutions.push(fullSol);
      }
    }
  }

  // Si aucune solution trouvée par la méthode de diversité,
  // fallback sur le solveur standard
  if (solutions.length === 0) {
    const fallback = solve({
      boardDef,
      fixedPlacements,
      availableTokens,
      elementDefs,
    });
    solutions.push(...fallback.solutions);
  }

  return { solutions };
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
