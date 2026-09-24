// ============================================================
// SCRIPT DE GENERATION DES DEFIS - V3
// Refonte complete selon GENERATOR_REFONTE.md :
//   Axe 0 : Unicite garantie (exactement 1 solution, ni 0 ni 2+)
//   Axe 1 : Diversite des solutions (memoire par niveau)
//   Axe 2 : Rotation garantie des compositions
//   Axe 3 : Tension narrative (renard/mouton, chalet/bucheron, chien/meute)
//   Axe 4 : Compositions enrichies avec variations 0-4
// Execution : npm run generate
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';
import { Challenge, DifficultyLevel, FixedPlacement, TokenCount } from '../src/core/models/Challenge';
import { LEVEL_PARAMS, Composition, LevelParams } from '../src/constants/difficulty';
import { solve } from '../src/core/engine/solver';

// Elements SANS require() d'assets
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

// Plateaux SANS require() d'assets
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

  board_7_v1: {
    id: 'board_7_v1', label: 'Clairiere', cellCount: 7,
    connections: [
      [1, 2],        // 0 — haut centre
      [0, 3, 4],     // 1 — milieu haut gauche
      [0, 3, 5],     // 2 — milieu haut droite
      [1, 2, 4, 5],  // 3 — centre (hub)
      [1, 3, 6],     // 4 — milieu bas gauche
      [2, 3, 6],     // 5 — milieu bas droite
      [4, 5],        // 6 — bas centre
    ],
    cellPositions: [
      { x: 50, y: 10 }, { x: 25, y: 32 }, { x: 75, y: 32 },
      { x: 50, y: 50 }, { x: 25, y: 68 }, { x: 75, y: 68 },
      { x: 50, y: 88 },
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
      [1, 5, 6],       // 3 — PAS de lien direct vers 4
      [2, 5, 7],       // 4 — PAS de lien direct vers 3
      [0, 3, 4, 6, 7], // 5 centre hub
      [3, 5, 7],       // 6 — connecté à 7
      [4, 5, 6],       // 7 — connecté à 6
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

  board_9_v1: {
    id: 'board_9_v1', label: 'Lisiere Etendue', cellCount: 9,
    connections: [
      [1, 2, 5],        // 0 — haut centre
      [0, 3],           // 1 — gauche haut
      [0, 4],           // 2 — droite haut
      [1, 4, 5, 6],     // 3 — gauche milieu
      [2, 3, 5, 7],     // 4 — droite milieu
      [0, 3, 4, 6, 7],  // 5 — centre milieu
      [3, 5, 8],        // 6 — gauche bas
      [4, 5, 8],        // 7 — droite bas
      [6, 7],           // 8 — bas centre (NOUVELLE)
    ],
    cellPositions: [
      { x: 50, y: 12 }, { x: 25, y: 30 }, { x: 75, y: 30 },
      { x: 25, y: 52 }, { x: 75, y: 52 }, { x: 50, y: 52 },
      { x: 25, y: 78 }, { x: 75, y: 78 }, { x: 50, y: 93 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'cerf', 'biche', 'renard', 'ruche'],
    specialCells: { corners: [0, 8], edges: [1, 2, 3, 4], center: [5, 6, 7] },
  },

  board_11_v1: {
    id: 'board_11_v1', label: 'Sous-bois Profond v1 (obsolète)', cellCount: 11,
    connections: [
      [3],                 // 0 — coin haut gauche
      [4, 5],              // 1 — haut centre
      [3],                 // 2 — coin haut droite
      [0, 2, 4, 5, 6, 10], // 3 — hub haut
      [1, 3, 6, 8, 10],   // 4 — milieu gauche
      [1, 3, 6, 8, 10],   // 5 — milieu droite
      [3, 4, 5, 7, 9, 10], // 6 — hub bas
      [6],                 // 7 — coin bas gauche
      [4, 5],              // 8 — bas centre
      [6],                 // 9 — coin bas droite
      [3, 4, 5, 6],        // 10 — centre absolu
    ],
    cellPositions: [
      { x: 12, y: 7 }, { x: 50, y: 7 }, { x: 88, y: 7 },
      { x: 50, y: 27 }, { x: 28, y: 46 }, { x: 72, y: 46 },
      { x: 50, y: 65 }, { x: 12, y: 91 }, { x: 50, y: 91 }, { x: 88, y: 91 },
      { x: 50, y: 46 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'cerf', 'biche', 'renard', 'ruche', 'tas_buches'],
    specialCells: { corners: [0, 2, 7, 9], center: [3, 6, 10], edges: [1, 4, 5, 8] },
  },

  // Nouvelle map lisible — niveaux 11, 12
  board_11_v2: {
    id: 'board_11_v2', label: 'Sous-bois Profond', cellCount: 11,
    connections: [
      [2],           // 0 — coin haut-gauche
      [2],           // 1 — coin haut-droite
      [0, 1, 3, 5],  // 2 — haut-centre
      [2, 4, 6],     // 3 — milieu-haut-gauche
      [3, 5, 6, 7],  // 4 — centre (hub)
      [2, 4, 7],     // 5 — milieu-haut-droite
      [3, 4, 8, 9],  // 6 — milieu-bas-gauche
      [4, 5, 8, 10], // 7 — milieu-bas-droite
      [6, 7, 9, 10], // 8 — bas-centre
      [6, 8],        // 9 — coin bas-gauche
      [7, 8],        // 10 — coin bas-droite
    ],
    cellPositions: [
      { x: 12, y: 8  }, { x: 88, y: 8  }, { x: 50, y: 20 },
      { x: 25, y: 38 }, { x: 50, y: 50 }, { x: 75, y: 38 },
      { x: 25, y: 62 }, { x: 75, y: 62 }, { x: 50, y: 78 },
      { x: 12, y: 92 }, { x: 88, y: 92 },
    ],
    backgroundAsset: null as any,
    availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'cerf', 'biche', 'renard', 'ruche', 'tas_buches'],
    specialCells: { corners: [0, 1, 9, 10], center: [4], edges: [2, 3, 5, 6, 7, 8] },
  },
};

// ============================================================
// AXE 1 : Signature d'une solution (detection doublons)
// ============================================================
function solutionSignature(solution: string[]): string {
  return solution.join(',');
}

// ============================================================
// AXE 2 : Signature d'un defi (detection doublons fixedPlacements)
// ============================================================
function challengeSignature(fixedPlacements: FixedPlacement[]): string {
  return fixedPlacements
    .slice()
    .sort((a, b) => a.cellIndex - b.cellIndex)
    .map(fp => `${fp.cellIndex}:${fp.elementId}`)
    .join('|');
}

// ============================================================
// AXE 3 : Tension narrative
// Verifie que les jetons a poser interagissent avec les jetons fixes
// pour creer une situation de jeu narrativement interessante.
// ============================================================
function isNarrativelyInteresting(
  availableTokens: TokenCount[],
  fixedPlacements: FixedPlacement[],
  composition: Composition
): boolean {
  const availableIds = new Set(availableTokens.map(t => t.elementId));
  const inCompo = (id: string) => ((composition as any)[id] ?? 0) > 0;

  // Regle B : si chalet present, au moins 1 bucheron doit etre a poser.
  // Le joueur doit decider ou placer le bucheron pour satisfaire le chalet.
  // (La regle renard/mouton est deja couverte par isChallengePedagogicallyValid
  // via la regle de diversite : si renard >= 2 ou mouton >= 2, au moins 1 reste a poser.)
  if (inCompo('chalet') && !availableIds.has('bucheron')) return false;

  return true;
}

// ============================================================
// AXE 0 : Verification pedagogique (conservee de V2)
// ============================================================
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

  // Regle meute : si chien present, au moins 1 chien doit etre a poser.
  // Le joueur doit placer au moins 1 chien pour raisonner sur la contrainte de meute
  // (adjacent a un autre chien). Meme avec chien=2, 1 fixe + 1 a poser suffit :
  // le joueur sait qu'il doit le poser adjacent au chien fixe.
  if (inCompo('chien')) {
    if (!availableIds.has('chien')) return false; // tous fixes : invalide
  }

  // Regle tension narrative chalet : au moins 1 bucheron a poser
  // Le joueur doit decider ou placer le bucheron pour satisfaire le chalet
  if (inCompo('chalet') && !availableIds.has('bucheron')) return false;

  // Note : on n'exige plus que mouton soit a poser quand renard est present.
  // mouton=0 avec renard est une composition valide (le joueur place le renard
  // en evitant les moutons fixes). La tension est assuree par les jetons fixes.

  // Regle ruche/ours : si ruche presente, ne pas fixer les deux simultanement.
  // - Si 1 seul ours : soit la ruche soit l'ours est fixe, pas les deux.
  // - Si plusieurs ours : ne pas fixer la ruche (l'ours reste a poser).
  // Raison : si les deux sont fixes, le joueur n'a rien a resoudre pour cette contrainte.
  if (inCompo('ruche')) {
    const oursTotal = totalInCompo('ours');
    const oursFixed = countFixed('ours');
    const rucheIsFixed = fixedPlacements.some(fp => fp.elementId === 'ruche');
    if (oursTotal >= 2) {
      // Plusieurs ours : ne pas fixer la ruche (au moins 1 ours reste a poser)
      if (rucheIsFixed) return false;
    } else {
      // 1 seul ours : pas les deux fixes en meme temps
      if (rucheIsFixed && oursFixed >= 1) return false;
    }
  }

  // Regle cerf/biche : si couple present, ne pas fixer les deux en meme temps.
  // Au moins l'un des deux (cerf ou biche) doit rester a poser.
  // Raison : si cerf ET biche sont tous les deux fixes, aucun interet pedagogique
  // pour la contrainte de couplage.
  if (inCompo('cerf') && inCompo('biche')) {
    const cerfFixed = countFixed('cerf');
    const bicheFixed = countFixed('biche');
    const cerfTotal = totalInCompo('cerf');
    const bicheTotal = totalInCompo('biche');
    // Si tous les cerfs ET toutes les biches sont fixes -> invalide
    if (cerfFixed >= cerfTotal && bicheFixed >= bicheTotal) return false;
    // Regle renforcee pour 1 seul couple : jamais cerf ET biche en fixed en meme temps
    if (cerfTotal === 1 && bicheTotal === 1 && cerfFixed >= 1 && bicheFixed >= 1) return false;
  }

  // Regle diversite : pour chaque element present en quantite >= 2,
  // au moins 1 exemplaire doit etre a poser (pas tous fixes).
  // Un element en 1 seul exemplaire peut etre fixe (indice pour le joueur).
  // Un element entierement a poser (0 fixe) est valide et meme interessant.
  for (const [id, total] of Object.entries(composition)) {
    if ((total ?? 0) < 2) continue; // 0 ou 1 exemplaire : pas de contrainte
    if (countAvail(id) === 0) return false; // tous fixes, aucun a poser
  }

  return true;
}

// ============================================================
// AXE 0 : Double verification coherence solution <-> defi
// Garantit exactement 1 solution (ni 0 ni 2+) et coherence
// ============================================================
function verifySolutionConsistency(
  solution: string[],
  fixedPlacements: FixedPlacement[],
  availableTokens: TokenCount[],
  boardDef: BoardDefinition
): boolean {
  // 1. Verifier que les fixedPlacements correspondent a la solution
  for (const fp of fixedPlacements) {
    if (solution[fp.cellIndex] !== fp.elementId) {
      console.error(
        `  Incoherence case ${fp.cellIndex}: fixe=${fp.elementId} mais solution=${solution[fp.cellIndex]}`
      );
      return false;
    }
  }
  // 2. Re-resoudre independamment (double passe)
  const check = solve({ boardDef, fixedPlacements, availableTokens, elementDefs });
  // 3. Verifier exactement 1 solution (ni 0 ni 2+)
  if (check.solutionCount === 0) {
    console.error('  Verification finale: 0 solution (defi impossible)');
    return false;
  }
  if (check.solutionCount > 1) {
    console.error(`  Verification finale: ${check.solutionCount} solutions (defi ambigu)`);
    return false;
  }
  // 4. Verifier que la solution trouvee = la solution stockee
  const foundSolution = check.solutions[0];
  if (!foundSolution.every((el, i) => el === solution[i])) {
    console.error('  Solution stockee != solution trouvee par le solveur');
    return false;
  }
  return true;
}

// ============================================================
// Utilitaires
// ============================================================
function compositionToTokens(composition: Composition): TokenCount[] {
  return Object.entries(composition)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([elementId, count]) => ({ elementId, count: count! }));
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

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
// GENERATEUR D'UN DEFI UNIQUE (V3)
// Integre les 4 axes de la refonte
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

  // ETAPE 1 - Axe 2 : Rotation des compositions (moins utilisees en premier)
  const compositionIndices = shuffleArray(params.compositions.map((_, i) => i))
    .sort((a, b) =>
      (compositionUsageCount.get(a) ?? 0) - (compositionUsageCount.get(b) ?? 0)
    );

  for (const compIdx of compositionIndices) {
    const composition = params.compositions[compIdx];
    const total = Object.values(composition).reduce((a, b) => a + (b ?? 0), 0);
    if (total !== params.cellCount) continue;

    const fullTokens = compositionToTokens(composition);

    // ETAPE 2 - Toutes les solutions valides pour cette composition
    const fullResult = solve({
      boardDef, fixedPlacements: [], availableTokens: fullTokens, elementDefs,
    });
    // Axe 0 : 0 solution -> composition impossible sur ce plateau
    if (fullResult.solutionCount === 0) continue;
    // Regle qualite : composition trop pauvre (< 2 solutions) -> impossible d'avoir de la diversite
    // Seuil a 2 pour ne pas bloquer les petits plateaux (6-8 cases) qui ont naturellement peu de solutions
    if (fullResult.solutionCount < 2) continue;

    // ETAPE 3 - Axe 1 : Uniquement les solutions jamais vues (pas de fallback)
    // Si toutes les solutions de cette composition sont deja utilisees -> composition suivante
    const freshSolutions = fullResult.solutions.filter(
      s => !usedSolutions.has(solutionSignature(s))
    );
    if (freshSolutions.length === 0) continue;

    // Diversite coins : ne garder que les solutions ou aucune paire de coins
    // consecutifs (dans la liste corners) n'a le meme element.
    // Sans fallback : si toutes les solutions ont des coins consecutifs identiques,
    // cette composition est sautee (on passe a la composition suivante).
    // Cela evite les solutions visuellement repetitives (ex: ours/ours dans les 2 coins bas).
    const boardCorners: number[] = (boardDef as any).specialCells?.corners ?? [];
    let candidateSolutions: string[][] = freshSolutions;
    if (boardCorners.length >= 2) {
      const diverseSolutions = freshSolutions.filter(s => {
        for (let k = 0; k < boardCorners.length - 1; k++) {
          if (s[boardCorners[k]] === s[boardCorners[k + 1]]) return false;
        }
        return true;
      });
      if (diverseSolutions.length === 0) continue; // aucune solution diverse -> composition suivante
      candidateSolutions = diverseSolutions;
    }

    // ETAPE 4 - Pour chaque solution candidate (ordre aleatoire)
    for (const solution of shuffleArray(candidateSolutions)) {
      const [minEmpty, maxEmpty] = params.emptyCellsRange;
      const targetEmpty = minEmpty + Math.floor(Math.random() * (maxEmpty - minEmpty + 1));
      const targetFixed = params.cellCount - targetEmpty;

      // ETAPE 5 - Chercher des fixedPlacements valides (120 tentatives)
      for (let attempt = 0; attempt < 120; attempt++) {
        const fixedIndices = shuffleArray([...Array(params.cellCount).keys()])
          .slice(0, targetFixed);

        const fixedPlacements: FixedPlacement[] = fixedIndices.map(idx => ({
          cellIndex: idx,
          elementId: solution[idx],
        }));

        // Contrainte paires de coins consecutifs identiques : interdire que 2 coins
        // consecutifs (adjacents dans la liste corners) soient tous deux fixes avec
        // le meme element. Les coins consecutifs sont ceux qui sont "voisins" dans
        // la liste ordonnee du board (ex: [0,6,7] -> paires (0,6) et (6,7)).
        // Cible specifiquement les coins symetriques comme 6 et 7 du board_8_v2.
        const corners = (boardDef as any).specialCells?.corners ?? [];
        if (corners.length >= 2) {
          let rejectForCorners = false;
          // Verifier les paires consecutives dans la liste corners
          for (let k = 0; k < corners.length - 1 && !rejectForCorners; k++) {
            const ca = corners[k];
            const cb = corners[k + 1];
            if (!fixedIndices.includes(ca) || !fixedIndices.includes(cb)) continue;
            if (solution[ca] === solution[cb]) rejectForCorners = true;
          }
          if (rejectForCorners) continue;
        }

        // Axe 2 : Defi jamais genere ?
        const cSig = challengeSignature(fixedPlacements);
        if (usedChallenges.has(cSig)) continue;

        const availableTokens = computeAvailable(composition, fixedPlacements);

        // Verification pedagogique
        if (!isChallengePedagogicallyValid(availableTokens, fixedPlacements, composition)) continue;

        // Axe 3 : Tension narrative
        if (!isNarrativelyInteresting(availableTokens, fixedPlacements, composition)) continue;

        // Axe 0 : Exactement 1 solution (ni 0 ni 2+)
        const result = solve({ boardDef, fixedPlacements, availableTokens, elementDefs });
        if (result.solutionCount === 0) continue; // defi impossible
        if (result.solutionCount > 1) continue;   // defi ambigu

        // Axe 0 : Double verification de coherence (garantie absolue)
        if (!verifySolutionConsistency(solution, fixedPlacements, availableTokens, boardDef)) {
          continue;
        }

        // Defi valide : exactement 1 solution, coherent, narrativement interessant
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
// Stats enrichies
// ============================================================
function logStats(
  level: string,
  challenges: Challenge[],
  params: LevelParams,
  usedSolutions: Set<string>,
  compositionUsageCount: Map<number, number>
): void {
  if (!challenges.length) { console.log('  Stats: aucun defi genere'); return; }
  const avgFixed = challenges.reduce((s, c) => s + c.fixedPlacements.length, 0) / challenges.length;
  const avgEmpty = params.cellCount - avgFixed;
  const avgTypes = challenges.reduce((s, c) => s + new Set(c.solution).size, 0) / challenges.length;
  console.log(`  fixes: ${avgFixed.toFixed(1)}, vides: ${avgEmpty.toFixed(1)}, types: ${avgTypes.toFixed(1)}`);
  console.log(`  Solutions uniques: ${usedSolutions.size}/${challenges.length}`);
  console.log(`  Compositions utilisees: ${compositionUsageCount.size}/${params.compositions.length}`);
}

// ============================================================
// Configuration : 15 niveaux
// ============================================================
const ALL_CONFIGS: Array<{ level: DifficultyLevel; count: number }> = [
  { level: 'niveau_1', count: 10 },
  { level: 'niveau_2', count: 10 },
  { level: 'niveau_3', count: 10 },
  { level: 'niveau_4', count: 10 },
  { level: 'niveau_5', count: 10 },
  { level: 'niveau_6', count: 10 },  // NOUVEAU : 9 cases
  { level: 'niveau_7', count: 10 },  // ex niv 6 (10 cases)
  { level: 'niveau_8', count: 10 },  // ex niv 7 (10 cases)
  { level: 'niveau_9', count: 10 },  // ex niv 8 (10 cases)
  { level: 'niveau_10', count: 10 }, // NOUVEAU : 11 cases
  { level: 'niveau_11', count: 10 }, // ex niv 9 (12 cases)
  { level: 'niveau_12', count: 10 }, // ex niv 10 (12 cases)
  { level: 'niveau_13', count: 10 }, // ex niv 11 (12 cases)
  { level: 'niveau_14', count: 10 }, // ex niv 12 (12 cases)
  { level: 'niveau_15', count: 10 }, // ex niv 13 (12 cases, bonus désactivés)
];

// ============================================================
// Parsing des arguments CLI
// Usage : ts-node generateChallenges.ts niveau_3 niveau_6
// Sans argument : genere tous les niveaux
// ============================================================
function parseLevelArgs(): DifficultyLevel[] | null {
  const args = process.argv.slice(2).filter(a => a.startsWith('niveau_'));
  if (args.length === 0) return null; // tous les niveaux
  return args as DifficultyLevel[];
}

// ============================================================
// Generation principale
// ============================================================
function generateAll() {
  const levelFilter = parseLevelArgs();
  const CONFIGS = levelFilter
    ? ALL_CONFIGS.filter(c => levelFilter.includes(c.level))
    : ALL_CONFIGS;

  if (levelFilter) {
    console.log(`Generateur de defis V3 - niveaux cibles : ${levelFilter.join(', ')}`);
  } else {
    console.log('Generateur de defis V3 - Dans la Foret (tous les niveaux)');
  }
  console.log('Axes: unicite stricte + diversite + rotation + tension narrative\n');

  let totalGenerated = 0;

  for (const { level, count } of CONFIGS) {
    const params = LEVEL_PARAMS[level];
    console.log(`\n[${level.toUpperCase()}] plateau ${params.cellCount} cases, ${count} defis...`);

    // Memoires par niveau (reinitialisees a chaque niveau)
    const usedSolutions = new Set<string>();
    const usedChallenges = new Set<string>();
    const compositionUsageCount = new Map<number, number>();

    const challenges: Challenge[] = [];
    let attempts = 0;
    const maxAttempts = count * 200; // augmente pour les niveaux contraints

    while (challenges.length < count && attempts < maxAttempts) {
      attempts++;
      const c = generateOneChallenge(
        level, challenges.length + 1,
        usedSolutions, usedChallenges, compositionUsageCount
      );
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
    logStats(level, challenges, params, usedSolutions, compositionUsageCount);
    totalGenerated += challenges.length;
  }

  console.log(`\nTermine ! ${totalGenerated} defis generes au total.`);

  // Regenerer le viewer automatiquement
  const { execSync } = require('child_process');
  console.log('\nMise a jour du viewer...');
  try {
    execSync(
      'npx ts-node --project tsconfig.scripts.json scripts/generateViewerData.ts',
      { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' }
    );
  } catch (e) {
    console.error('Erreur viewer:', e);
  }
}

generateAll();
