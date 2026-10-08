// ============================================================
// TESTS DU MOTEUR DE BONUS
// ============================================================

import {
  getValidCellsForElement,
  getErrorCells,
} from '../src/core/engine/hintEngine';
import { BoardDefinition } from '../src/core/models/Board';
import { ElementDefinition } from '../src/core/models/Element';

// ── Plateau de test : 4 cases en ligne  0-1-2-3 ──────────────
// Connexions : 0↔1, 1↔2, 2↔3
const testBoard: BoardDefinition = {
  id: 'test_board',
  label: 'Test',
  cellCount: 4,
  cellPositions: [
    { x: 10, y: 50 },
    { x: 40, y: 50 },
    { x: 60, y: 50 },
    { x: 90, y: 50 },
  ],
  connections: [
    [1],      // 0 → voisin : 1
    [0, 2],   // 1 → voisins : 0, 2
    [1, 3],   // 2 → voisins : 1, 3
    [2],      // 3 → voisin : 2
  ],
  backgroundAsset: '',
  availableElements: ['bucheron', 'ours', 'chien', 'loup', 'mouton'],
};

// ── Définitions d'éléments de test ───────────────────────────
const testElements: Record<string, ElementDefinition> = {
  bucheron: {
    id: 'bucheron', label: 'Bucheron', icon: '', color: '#000',
    maxPerBoard: 4,
    constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }],
  },
  ours: {
    id: 'ours', label: 'Ours', icon: '', color: '#000',
    maxPerBoard: 4,
    constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }],
  },
  chien: {
    id: 'chien', label: 'Chien', icon: '', color: '#000',
    maxPerBoard: 4,
    // Doit avoir au moins 1 voisin chien
    constraints: [{ type: 'neighbor_same', mode: 'require', scope: 'neighbor', minCount: 1 }],
  },
  Loup: {
    id: 'loup', label: 'loup', icon: '', color: '#000',
    maxPerBoard: 4,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
      { type: 'neighbor_specific', mode: 'forbid', scope: 'neighbor', targetElementId: 'mouton' },
    ],
  },
  mouton: {
    id: 'mouton', label: 'Mouton', icon: '', color: '#000',
    maxPerBoard: 4,
    constraints: [{ type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' }],
  },
};

describe('HintEngine - getValidCellsForElement (basé sur les règles)', () => {

  it('exclut les cases déjà occupées', () => {
    const board: (string | null)[] = [null, null, null, null];
    board[0] = 'bucheron';
    const cells = getValidCellsForElement('ours', board, testBoard, testElements);
    expect(cells).not.toContain(0);
  });

  it('bucheron : exclut les cases voisines d\'un bucheron déjà posé', () => {
    // Plateau : [bucheron, null, null, null]
    // Case 1 est voisine de 0 (bucheron) → interdite pour bucheron
    // Cases 2 et 3 sont libres et non voisines d'un bucheron → autorisées
    const board: (string | null)[] = ['bucheron', null, null, null];
    const cells = getValidCellsForElement('bucheron', board, testBoard, testElements);
    expect(cells).not.toContain(0); // occupée
    expect(cells).not.toContain(1); // voisine du bucheron en 0
    expect(cells).toContain(2);
    expect(cells).toContain(3);
  });

  it('chien : seules les cases directement voisines d\'un chien déjà posé sont valides', () => {
    // Plateau : [chien, null, null, null]
    // Case 1 : voisins = [0(chien), 2(null)] → a un voisin chien → VALIDE
    // Case 2 : voisins = [1(null), 3(null)]  → pas de voisin chien → INVALIDE
    // Case 3 : voisins = [2(null)]           → pas de voisin chien → INVALIDE
    const board: (string | null)[] = ['chien', null, null, null];
    const cells = getValidCellsForElement('chien', board, testBoard, testElements);
    expect(cells).toContain(1);      // voisine directe du chien
    expect(cells).not.toContain(2);  // pas de voisin chien
    expect(cells).not.toContain(3);  // pas de voisin chien
  });

  it('chien : aucune case valide si aucun chien n\'est posé', () => {
    // Sans chien déjà posé, impossible de satisfaire la contrainte "require"
    const board: (string | null)[] = [null, null, null, null];
    const cells = getValidCellsForElement('chien', board, testBoard, testElements);
    expect(cells).toHaveLength(0);
  });

  it('chien : case isolée sans voisin chien → exclue même si des cases libres existent', () => {
    // Plateau : [bucheron, bucheron, bucheron, null]
    // Case 3 : voisins = [2(bucheron)] → pas de voisin chien → impossible
    const board: (string | null)[] = ['bucheron', 'bucheron', 'bucheron', null];
    const cells = getValidCellsForElement('chien', board, testBoard, testElements);
    expect(cells).not.toContain(3);
  });

  it('Loup : exclut les cases voisines d\'un mouton', () => {
    // Plateau : [null, mouton, null, null]
    // Case 0 : voisins = [1(mouton)] → interdit pour Loup
    // Case 2 : voisins = [1(mouton), 3(null)] → interdit pour Loup
    // Case 3 : voisins = [2(null)] → OK
    const board: (string | null)[] = [null, 'mouton', null, null];
    const cells = getValidCellsForElement('loup', board, testBoard, testElements);
    expect(cells).not.toContain(0); // voisin du mouton
    expect(cells).not.toContain(1); // occupée
    expect(cells).not.toContain(2); // voisin du mouton
    expect(cells).toContain(3);
  });

  it('retourne toutes les cases vides si le plateau est vide (bucheron)', () => {
    const board: (string | null)[] = [null, null, null, null];
    const cells = getValidCellsForElement('bucheron', board, testBoard, testElements);
    // Toutes les cases sont libres et aucune règle n'est violée
    expect(cells).toEqual([0, 1, 2, 3]);
  });

  it('retourne un tableau vide si toutes les cases sont occupées', () => {
    const board: (string | null)[] = ['bucheron', 'ours', 'bucheron', 'ours'];
    const cells = getValidCellsForElement('mouton', board, testBoard, testElements);
    expect(cells).toHaveLength(0);
  });

  it('ne révèle pas la solution : plusieurs cases possibles même si une seule est correcte', () => {
    // Plateau vide, on cherche où placer 'ours'
    // Toutes les cases sont légalement possibles (ours n'a que neighbor_same forbid)
    // La solution peut n'avoir 'ours' qu'en case 2, mais le bonus doit montrer toutes les cases libres
    const board: (string | null)[] = [null, null, null, null];
    const cells = getValidCellsForElement('ours', board, testBoard, testElements);
    // Doit retourner PLUS d'une case (pas seulement la bonne)
    expect(cells.length).toBeGreaterThan(1);
  });
});

describe('HintEngine - getErrorCells (bonus Instinct)', () => {
  const solution = ['bucheron', 'mouton', 'ours', 'loup'];

  it('retourne les cases incorrectes (non fixes)', () => {
    const playerBoard: (string | null)[] = ['bucheron', 'ours', 'ours', null];
    const fixedCells = new Set([0]); // case 0 est fixe
    const errors = getErrorCells(playerBoard, solution, fixedCells);
    // Case 0 : fixe → jamais en erreur
    // Case 1 : ours ≠ mouton → ERREUR
    // Case 2 : ours === ours → correct
    // Case 3 : null → pas d'erreur
    expect(errors).toEqual([1]);
  });

  it('ne retourne rien si tout est correct', () => {
    const playerBoard: (string | null)[] = ['bucheron', 'mouton', 'ours', 'loup'];
    const fixedCells = new Set([0]);
    const errors = getErrorCells(playerBoard, solution, fixedCells);
    expect(errors).toHaveLength(0);
  });

  it('ignore les cases vides', () => {
    const playerBoard: (string | null)[] = [null, null, null, null];
    const fixedCells = new Set<number>();
    const errors = getErrorCells(playerBoard, solution, fixedCells);
    expect(errors).toHaveLength(0);
  });

  it('ignore les cases fixes même si elles diffèrent de la solution', () => {
    // Cas théorique : une case fixe contenant un mauvais élément
    // → ne devrait jamais arriver en jeu, mais le moteur doit les ignorer
    const playerBoard: (string | null)[] = ['ours', 'mouton', 'ours', 'loup'];
    const fixedCells = new Set([0]); // case 0 fixe, contient 'ours' au lieu de 'bucheron'
    const errors = getErrorCells(playerBoard, solution, fixedCells);
    expect(errors).not.toContain(0);
  });

  it('retourne toutes les erreurs quand tout est faux', () => {
    const playerBoard: (string | null)[] = ['loup', 'ours', 'mouton', 'bucheron'];
    const fixedCells = new Set<number>();
    const errors = getErrorCells(playerBoard, solution, fixedCells);
    expect(errors).toEqual([0, 1, 2, 3]);
  });
});

// ══════════════════════════════════════════════════════════════
// TESTS — placementRules (center_only / edge_only / corner_only)
// ══════════════════════════════════════════════════════════════

describe('HintEngine - getValidCellsForElement (placementRules)', () => {

  // Plateau de test 6 cases : un hexagone simple
  //    [0]---[1]---[2]
  //     |         |
  //    [3]---[4]---[5]
  const boardWithSpecialCells: BoardDefinition = {
    id: 'test_special',
    label: 'Test Special',
    cellCount: 6,
    cellPositions: [
      { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 },
      { x: 10, y: 90 }, { x: 50, y: 90 }, { x: 90, y: 90 },
    ],
    connections: [
      [1, 3],    // 0
      [0, 2, 4], // 1
      [1, 5],    // 2
      [0, 4],    // 3
      [1, 3, 5], // 4
      [2, 4],    // 5
    ],
    backgroundAsset: '',
    availableElements: ['bucheron', 'champignon'],
    specialCells: {
      center:  [1, 4],          // 2 cases centrales
      corners: [0, 2, 3, 5],    // 4 cases coins
      edges:   [],
    },
  };

  const champignonDef: ElementDefinition = {
    id: 'champignon', label: 'Champignon', icon: '', color: '#8B6914',
    maxPerBoard: 3,
    constraints: [
      { type: 'neighbor_same', mode: 'forbid', scope: 'neighbor' },
    ],
    placementRules: [
      { type: 'center_only' },
    ],
  };

  const cornerOnlyDef: ElementDefinition = {
    id: 'corner_element', label: 'Corner', icon: '', color: '#000',
    maxPerBoard: 4,
    constraints: [],
    placementRules: [
      { type: 'corner_only' },
    ],
  };

  const whitelistDef: ElementDefinition = {
    id: 'whitelist_element', label: 'Whitelist', icon: '', color: '#000',
    maxPerBoard: 2,
    constraints: [],
    placementRules: [
      { type: 'cell_whitelist', allowedCells: [0, 5] },
    ],
  };

  const elementsWithPlacement: Record<string, ElementDefinition> = {
    ...testElements,
    champignon: champignonDef,
    corner_element: cornerOnlyDef,
    whitelist_element: whitelistDef,
  };

  it('champignon center_only : seules les cases center sont valides', () => {
    const board: (string | null)[] = [null, null, null, null, null, null];
    const cells = getValidCellsForElement(
      'champignon', board, boardWithSpecialCells, elementsWithPlacement
    );
    // Seules cases 1 et 4 sont center
    expect(cells).toEqual(expect.arrayContaining([1, 4]));
    expect(cells).toHaveLength(2);
    expect(cells).not.toContain(0);
    expect(cells).not.toContain(2);
    expect(cells).not.toContain(3);
    expect(cells).not.toContain(5);
  });

  it('champignon center_only + neighbor_same forbid : exclut la case voisine d\'un champignon', () => {
    const board: (string | null)[] = [null, 'champignon', null, null, null, null];
    // Case 1 occupée par champignon
    // Case 4 est center ET voisine de 1 → interdit par neighbor_same forbid
    const cells = getValidCellsForElement(
      'champignon', board, boardWithSpecialCells, elementsWithPlacement
    );
    expect(cells).toHaveLength(0); // Aucune case valide (4 est voisine du champignon en 1)
  });

  it('corner_only : seules les cases corners sont valides', () => {
    const board: (string | null)[] = [null, null, null, null, null, null];
    const cells = getValidCellsForElement(
      'corner_element', board, boardWithSpecialCells, elementsWithPlacement
    );
    expect(cells).toEqual(expect.arrayContaining([0, 2, 3, 5]));
    expect(cells).toHaveLength(4);
    expect(cells).not.toContain(1);
    expect(cells).not.toContain(4);
  });

  it('cell_whitelist : seules les cases listées sont valides', () => {
    const board: (string | null)[] = [null, null, null, null, null, null];
    const cells = getValidCellsForElement(
      'whitelist_element', board, boardWithSpecialCells, elementsWithPlacement
    );
    expect(cells).toEqual(expect.arrayContaining([0, 5]));
    expect(cells).toHaveLength(2);
  });

  it('center_only sur un plateau sans specialCells.center : aucune case valide', () => {
    const boardNoCenter: BoardDefinition = {
      ...testBoard,
      specialCells: undefined,
    };
    const board: (string | null)[] = [null, null, null, null];
    const cells = getValidCellsForElement(
      'champignon', board, boardNoCenter, elementsWithPlacement
    );
    expect(cells).toHaveLength(0);
  });

  it('élément sans placementRules : toutes les cases restent éligibles', () => {
    const board: (string | null)[] = [null, null, null, null, null, null];
    const cells = getValidCellsForElement(
      'bucheron', board, boardWithSpecialCells, elementsWithPlacement
    );
    // bucheron n'a pas de placementRules → toutes les 6 cases sont valides
    expect(cells).toHaveLength(6);
  });
});
