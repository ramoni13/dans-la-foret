// ============================================================
// PLATEAU ONF 4×4 — Grille Forestière (Mode Sudoku Forestier)
//
// Disposition :
//   [ 0][ 1][ 2][ 3]  ← ligne 0
//   [ 4][ 5][ 6][ 7]  ← ligne 1
//   [ 8][ 9][10][11]  ← ligne 2
//   [12][13][14][15]  ← ligne 3
//
// Connexions : orthogonales uniquement (haut/bas/gauche/droite)
// gridMeta : lignes et colonnes pour la contrainte row_col_unique
// ============================================================

import { BoardDefinition } from '../core/models/Board';

export const board4x4Onf: BoardDefinition = {
  id: 'board_4x4_onf',
  label: 'Forêt Carrée',
  cellCount: 16,

  // Connexions orthogonales
  connections: [
    [1, 4],           //  0 — (col 0, row 0)
    [0, 2, 5],        //  1 — (col 1, row 0)
    [1, 3, 6],        //  2 — (col 2, row 0)
    [2, 7],           //  3 — (col 3, row 0)
    [0, 5, 8],        //  4 — (col 0, row 1)
    [1, 4, 6, 9],     //  5 — (col 1, row 1)
    [2, 5, 7, 10],    //  6 — (col 2, row 1)
    [3, 6, 11],       //  7 — (col 3, row 1)
    [4, 9, 12],       //  8 — (col 0, row 2)
    [5, 8, 10, 13],   //  9 — (col 1, row 2)
    [6, 9, 11, 14],   // 10 — (col 2, row 2)
    [7, 10, 15],      // 11 — (col 3, row 2)
    [8, 13],          // 12 — (col 0, row 3)
    [9, 12, 14],      // 13 — (col 1, row 3)
    [10, 13, 15],     // 14 — (col 2, row 3)
    [11, 14],         // 15 — (col 3, row 3)
  ],

  // Positions en % : x = 12.5 + col*25, y = 12.5 + row*25
  cellPositions: [
    { x: 12.5, y: 12.5 }, //  0 (col 0, row 0)
    { x: 37.5, y: 12.5 }, //  1 (col 1, row 0)
    { x: 62.5, y: 12.5 }, //  2 (col 2, row 0)
    { x: 87.5, y: 12.5 }, //  3 (col 3, row 0)
    { x: 12.5, y: 37.5 }, //  4 (col 0, row 1)
    { x: 37.5, y: 37.5 }, //  5 (col 1, row 1)
    { x: 62.5, y: 37.5 }, //  6 (col 2, row 1)
    { x: 87.5, y: 37.5 }, //  7 (col 3, row 1)
    { x: 12.5, y: 62.5 }, //  8 (col 0, row 2)
    { x: 37.5, y: 62.5 }, //  9 (col 1, row 2)
    { x: 62.5, y: 62.5 }, // 10 (col 2, row 2)
    { x: 87.5, y: 62.5 }, // 11 (col 3, row 2)
    { x: 12.5, y: 87.5 }, // 12 (col 0, row 3)
    { x: 37.5, y: 87.5 }, // 13 (col 1, row 3)
    { x: 62.5, y: 87.5 }, // 14 (col 2, row 3)
    { x: 87.5, y: 87.5 }, // 15 (col 3, row 3)
  ],

  backgroundAsset: require('../../assets/boards/fond.jpg'),

  // Éléments compatibles avec le mode ONF 4×4
  // champignon : center_only → uniquement cases centrales [5, 6, 9, 10] (chantier 1)
  availableElements: ['bucheron', 'ours', 'mouton', 'loup', 'ruche', 'cerf', 'biche', 'champignon'],

  // Cases spéciales : le centre géométrique de la grille 4×4
  // (ligne 1 col 1=5, ligne 1 col 2=6, ligne 2 col 1=9, ligne 2 col 2=10)
  // Requis pour le placement center_only du champignon.
  specialCells: {
    center: [5, 6, 9, 10],
  },

  // Métadonnées de grille ONF
  gridMeta: {
    rows: [
      [0,  1,  2,  3],  // ligne 0
      [4,  5,  6,  7],  // ligne 1
      [8,  9, 10, 11],  // ligne 2
      [12, 13, 14, 15], // ligne 3
    ],
    cols: [
      [0,  4,  8, 12], // colonne 0
      [1,  5,  9, 13], // colonne 1
      [2,  6, 10, 14], // colonne 2
      [3,  7, 11, 15], // colonne 3
    ],
  },
};
