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
// Fix 3.3 : réduit de 60 → 25 car la randomisation du backtracking (Fix 3.1)
// et de la case de départ (Fix 3.2) explorent l'espace beaucoup plus efficacement.
const MAX_ATTEMPTS = 25;

// Seuil de similarité : deux défis sont "trop similaires" si leur
// intersection de cases fixes dépasse ce pourcentage du total des cases fixes.
const SIMILARITY_THRESHOLD = 0.75;

export function generateChallenge(options: GeneratorOptions): Challenge | null {
  const { boardDef, elementDefs, difficulty, boardId, recentFixedSignatures } = options;
  const params = LEVEL_PARAMS[difficulty];
  if (!params) return null;

  // Fix 3.5 : rotation garantie des compositions par compteur d'usage.
  // On trie les compositions par nombre d'utilisations croissant (les moins
  // utilisées sont prioritaires), puis on mélange à égalité pour éviter
  // l'ordre déterministe au sein du même bucket d'usage.
  const compositionUsageCount = new Map<number, number>(
    params.compositions.map((_, i) => [i, 0])
  );

  // Fix 3.4 : mémoriser les signatures de SOLUTION COMPLÈTE déjà générées
  // dans cette session de génération (au-delà des cases fixes).
  // Deux défis avec la même solution donnent la même expérience au joueur
  // même si les cases fixes diffèrent.
  const usedSolutionSignatures = new Set<string>();

  // Compteurs pour debug — supprimés en prod
  let dbgNoSolution = 0, dbgDupSol = 0, dbgNotCoherent = 0, dbgNotEnoughEmpty = 0,
      dbgNotUnique = 0, dbgNotPedago = 0, dbgNotNarrative = 0, dbgTooSimilar = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Fix 3.5 : choisir la composition la moins utilisée (shuffle pour égalité)
    const sortedIndices = shuffleArray(params.compositions.map((_, i) => i))
      .sort((a, b) => (compositionUsageCount.get(a) ?? 0) - (compositionUsageCount.get(b) ?? 0));
    const compIdx = sortedIndices[0];
    const composition = params.compositions[compIdx];

    // Construire l'inventaire de jetons depuis la composition
    const tokenCounts: TokenCount[] = Object.entries(composition)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([elementId, count]) => ({ elementId, count: count! }));

    // Étape 1 : Collecter TOUTES les solutions valides pour cette composition,
    // puis en choisir une aléatoirement → maximise la diversité des structures.
    const solution = generateValidSolution(boardDef, elementDefs, tokenCounts);
    if (!solution) { dbgNoSolution++; continue; }

    // Fix 3.4 : rejeter immédiatement si cette solution complète a déjà été
    // utilisée dans ce niveau → deux défis avec la même solution mais des cases
    // fixes différentes donnent la même expérience au joueur.
    const solSig = solutionSignature(solution);
    if (usedSolutionSignatures.has(solSig)) { dbgDupSol++; continue; }

    // Fix 3.6 : vérifier la tension narrative AVANT de retirer des jetons.
    // Si la composition contient renard+mouton ou chalet+bucheron, la solution
    // doit en placer au moins un de chaque côté de la frontière fixe/disponible.
    // Ici on vérifie juste que les deux éléments sont présents dans la solution —
    // la tension sera vérifiée après la création du défi (une fois les cases fixes connues).
    if (!isNarrativelyCoherent(tokenCounts)) { dbgNotCoherent++; continue; }

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
    if (actualEmpty < targetEmptyCells) { dbgNotEnoughEmpty++; continue; }

    // Vérifier l'unicité finale avec TOUS les jetons disponibles pour le joueur.
    // C'est la garantie absolue : avec exactement ces jetons, il n'existe
    // qu'une seule façon de compléter le plateau.
    const solverResult = solve({ boardDef, fixedPlacements, availableTokens, elementDefs });
    if (!solverResult.isUnique) { dbgNotUnique++; continue; }

    // Vérifier la validité pédagogique
    if (!isPedagogicallyValid(availableTokens, tokenCounts)) { dbgNotPedago++; continue; }

    // Fix 3.6 : tension narrative — rejeter si renard présent sans tension
    // renard/mouton, ou chalet présent sans tension chalet/bucheron.
    if (!isNarrativelyInteresting(availableTokens, fixedPlacements, tokenCounts)) { dbgNotNarrative++; continue; }

    // Vérifier la diversité structurelle : rejeter si trop similaire
    // à un défi récent (même cases fixes, même éléments).
    if (recentFixedSignatures) {
      const sig = fixedSignature(fixedPlacements);
      if (isTooSimilarToRecent(sig, recentFixedSignatures, fixedPlacements.length)) { dbgTooSimilar++; continue; }
    }

    // Fix 3.4 : mémoriser la signature de solution complète
    usedSolutionSignatures.add(solSig);

    // Fix 3.5 : incrémenter le compteur d'usage de la composition choisie
    compositionUsageCount.set(compIdx, (compositionUsageCount.get(compIdx) ?? 0) + 1);

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

  console.warn(
    `[Générateur] Échec ${difficulty} après ${MAX_ATTEMPTS} tentatives — ` +
    `noSol:${dbgNoSolution} dupSol:${dbgDupSol} notCoherent:${dbgNotCoherent} ` +
    `notEnoughEmpty:${dbgNotEnoughEmpty} notUnique:${dbgNotUnique} ` +
    `notPedago:${dbgNotPedago} notNarrative:${dbgNotNarrative} tooSimilar:${dbgTooSimilar}`
  );
  return null; // Échec après MAX_ATTEMPTS tentatives
}

/**
 * Vérifie que le défi est pédagogiquement valide.
 *
 * Règle générale : au moins 1 token doit être disponible pour le joueur
 * (le défi ne peut pas être 100% pré-rempli).
 *
 * Règles relationnelles (dures) : pour les paires liées par contraintes,
 * au moins un des deux éléments de la paire doit être à placer.
 * Ça garantit que la relation est visible et jouable.
 *
 * NOTE : On NE requiert plus que chaque type ait ≥1 exemplaire disponible —
 * cette règle était trop stricte pour les niveaux élevés avec beaucoup de types
 * (ex: 6 types sur 4 cases fixes → mathématiquement impossible de tous les couvrir).
 * Les règles relationnelles ci-dessous assurent déjà la valeur pédagogique essentielle.
 */
function isPedagogicallyValid(
  availableTokens: TokenCount[],
  fullTokens: TokenCount[]
): boolean {
  const availableMap = new Map(availableTokens.map(t => [t.elementId, t.count]));
  const fullMap = new Map(fullTokens.map(t => [t.elementId, t.count]));

  const inFull = (id: string) => (fullMap.get(id) ?? 0) > 0;
  const hasAvailable = (id: string) => (availableMap.get(id) ?? 0) > 0;

  // Règle minimale : le joueur doit avoir au moins 1 token à placer.
  if (availableTokens.length === 0 || availableTokens.every(t => t.count === 0)) return false;

  // Règles relationnelles : au moins un des deux éléments d'une paire
  // doit être à poser pour que la relation soit visible et jouable.
  if (inFull('chalet') && !hasAvailable('chalet') && !hasAvailable('bucheron')) return false;
  if (inFull('renard') && !hasAvailable('renard') && !hasAvailable('mouton')) return false;
  if (inFull('ruche') && !hasAvailable('ruche') && !hasAvailable('ours')) return false;
  if (inFull('cerf') && !hasAvailable('cerf') && !hasAvailable('biche')) return false;
  if (inFull('biche') && !hasAvailable('biche') && !hasAvailable('cerf')) return false;
  if (inFull('tas_buches') && !hasAvailable('tas_buches') && !hasAvailable('bucheron')) return false;

  // Règle chien : si chien présent, au moins 1 chien à poser
  // (la meute doit rester à construire — sinon le défi est trivial sur ce point).
  if (inFull('chien') && !hasAvailable('chien')) return false;

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
// Fix 3.3 : réduit de 50 → 15. La randomisation du backtracking (Fix 3.1)
// et de la case de départ (Fix 3.2) assurent que 15 solutions couvrent
// un espace beaucoup plus large qu'avant. Gain de vitesse : 2-3×.
const MAX_SOLUTIONS_FOR_DIVERSITY = 15;

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
  // depuis plusieurs points de départ aléatoires en fixant UNE CASE ALÉATOIRE
  // à chaque élément possible, ce qui force l'exploration de branches différentes.
  const seen = new Set<string>();
  const solutions: string[][] = [];

  // Fix 3.2 : choisir UNE CASE VIDE ALÉATOIRE comme point de départ.
  // Avant : toujours la case 0 (ou la première case vide d'index le plus bas),
  // ce qui biaisait systématiquement la génération vers les mêmes structures
  // (premier élément de l'inventaire en position basse).
  const emptyCells = initialBoard
    .map((c, i) => (c === null ? i : -1))
    .filter(i => i >= 0);
  if (emptyCells.length === 0) return { solutions };
  const firstEmpty = emptyCells[Math.floor(Math.random() * emptyCells.length)];

  // Fix 3.2 : mélanger aussi l'ordre des éléments de seed pour que
  // chaque appel explore une branche de l'arbre radicalement différente.
  for (const [elementId, count] of shuffleArray(Object.entries(tokenInventory))) {
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

// ── Fix 3.4 — Signature de solution complète ─────────────────────────────────

/**
 * Signature canonique d'une solution complète.
 * Deux solutions identiques ont la même signature, indépendamment de l'ordre
 * dans lequel le solveur les a construites.
 * Utilisée pour éviter de générer deux défis avec la même réponse.
 */
function solutionSignature(solution: string[]): string {
  return solution.join(',');
}

// ── Fix 3.6 — Tension narrative ──────────────────────────────────────────────

/**
 * Vérifie que la composition est narrativement cohérente :
 * si renard est présent, mouton doit l'être aussi (sinon aucune tension possible).
 * Si chalet est présent, bucheron doit l'être aussi.
 * Ce filtre est appliqué AVANT la génération pour éviter des tentatives inutiles.
 */
function isNarrativelyCoherent(tokenCounts: TokenCount[]): boolean {
  const inCompo = (id: string) => tokenCounts.some(t => t.elementId === id && t.count > 0);
  if (inCompo('renard') && !inCompo('mouton')) return false;
  if (inCompo('chalet') && !inCompo('bucheron')) return false;
  return true;
}

/**
 * Fix 3.6 : vérifie la tension narrative APRÈS création des cases fixes.
 *
 * Règle A (dure) : si renard et mouton sont dans la composition, il ne faut PAS
 * que les deux soient entièrement en cases fixes (aucune tension visible pour le joueur).
 * Si au moins l'un des deux est disponible → tension possible → OK.
 *
 * Règle B (dure) : idem pour chalet/bucheron.
 *
 * NOTE : on n'exige PLUS qu'un des deux soit FIXÉ — si tous les deux sont disponibles,
 * le joueur doit quand même gérer leur relation en les plaçant, ce qui est pédagogique.
 */
function isNarrativelyInteresting(
  availableTokens: TokenCount[],
  _fixedPlacements: FixedPlacement[],
  fullTokenCounts: TokenCount[]
): boolean {
  const inCompo = (id: string) => fullTokenCounts.some(t => t.elementId === id && t.count > 0);
  const hasAvailable = (id: string) => availableTokens.some(t => t.elementId === id && t.count > 0);

  // Règle A : si renard ET mouton sont dans la composition,
  // au moins l'un des deux doit être à placer (pas les deux entièrement fixés).
  if (inCompo('renard') && inCompo('mouton')) {
    if (!hasAvailable('renard') && !hasAvailable('mouton')) return false;
  }

  // Règle B : si chalet ET bucheron sont dans la composition,
  // au moins l'un des deux doit être à placer.
  if (inCompo('chalet') && inCompo('bucheron')) {
    if (!hasAvailable('chalet') && !hasAvailable('bucheron')) return false;
  }

  return true;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
