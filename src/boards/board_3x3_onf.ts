// ============================================================
// PLATEAU ONF 3×3 — Grille Forestière (Mode Sudoku Forestier)
//
// Disposition :
//   [0][1][2]  ← ligne 0
//   [3][4][5]  ← ligne 1
//   [6][7][8]  ← ligne 2
//
// Connexions : orthogonales uniquement (haut/bas/gauche/droite)
// gridMeta : lignes et colonnes pour la contrainte row_col_unique
// ============================================================

import { BoardDefinition } from '../core/models/Board';

export const board3x3Onf: BoardDefinition = {
  id: 'board_3x3_onf',
  label: 'Clairière Carrée',
  cellCount: 9,

  // Connexions orthogonales (pas de diagonales)
  connections: [
    [1, 3],          // 0 — coin haut-gauche
    [0, 2, 4],       // 1 — bord haut-centre
    [1, 5],          // 2 — coin haut-droite
    [0, 4, 6],       // 3 — bord gauche-centre
    [1, 3, 5, 7],    // 4 — centre
    [2, 4, 8],       // 5 — bord droite-centre
    [3, 7],          // 6 — coin bas-gauche
    [4, 6, 8],       // 7 — bord bas-centre
    [5, 7],          // 8 — coin bas-droite
  ],

  // Positions en % : x = 20 + col*30, y = 20 + row*30
  // (col, row) → case index = row*3 + col
  cellPositions: [
    { x: 20, y: 20 }, // 0 (col 0, row 0)
    { x: 50, y: 20 }, // 1 (col 1, row 0)
    { x: 80, y: 20 }, // 2 (col 2, row 0)
    { x: 20, y: 50 }, // 3 (col 0, row 1)
    { x: 50, y: 50 }, // 4 (col 1, row 1) — centre
    { x: 80, y: 50 }, // 5 (col 2, row 1)
    { x: 20, y: 80 }, // 6 (col 0, row 2)
    { x: 50, y: 80 }, // 7 (col 1, row 2)
    { x: 80, y: 80 }, // 8 (col 2, row 2)
  ],

  backgroundAsset: require('../../assets/boards/fond.jpg'),

  // Éléments compatibles avec le mode ONF (pas de chien ni champignon)
  availableElements: ['bucheron', 'ours', 'mouton', 'loup', 'ruche'],

  // Métadonnées de grille ONF
  gridMeta: {
    rows: [
      [0, 1, 2], // ligne 0
      [3, 4, 5], // ligne 1
      [6, 7, 8], // ligne 2
    ],
    cols: [
      [0, 3, 6], // colonne 0
      [1, 4, 7], // colonne 1
      [2, 5, 8], // colonne 2
    ],
  },
};
