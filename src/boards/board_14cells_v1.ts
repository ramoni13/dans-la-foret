import { BoardDefinition } from '../core/models/Board';

// ============================================================
// PLATEAU 14 CASES — Cœur Profond (niveaux 19-21)
//
// Structure : 4 coins + 4 bords extérieurs + 6 intérieurs
//
// Numérotation (0-indexed) :
//   Ligne haute ext  :  0=coin-NW   1=sat-N-G    2=sat-N-D    3=coin-NE
//   Ligne med-haute  :  4=inner-NW  5=inner-N    6=inner-NE
//   Ligne med-basse  :  7=inner-SW  8=inner-S    9=inner-SE
//   Ligne basse ext  : 10=coin-SW  11=sat-S-G   12=sat-S-D   13=coin-SE
//
// Connexions (variante A — validée) :
//   Extérieur haut : 0─1─2─3
//   Extérieur bas  : 10─11─12─13
//   Côtés coins    : 0─10, 3─13
//   Coins→inner    : 0─4, 3─6, 10─7, 13─9
//   Sats→inner     : 1─4, 1─5, 2─5, 2─6 (haut) / 11─7, 11─8, 12─8, 12─9 (bas)
//   Anneau inner   : 4─5─6 (haut) / 7─8─9 (bas) / 5─8 (colonne centrale)
//
// Degrés :
//   Coins (0,3,10,13) : deg 3
//   Bords ext (1,2,11,12) : deg 4
//   Inner latéraux (4,6,7,9) : deg 4
//   Inner centraux (5,8)     : deg 5  ← hubs
//
// Total arêtes : 27 — Degré moyen : 3.86
// ============================================================

export const board14cellsV1: BoardDefinition = {
  id: 'board_14_v1',
  label: 'Cœur Profond',
  cellCount: 14,

  connections: [
    [1, 4, 10],        // 0  — coin-NW    : sat-N-G + inner-NW + coin-SW
    [0, 2, 4, 5],      // 1  — sat-N-G    : coin-NW + sat-N-D + inner-NW + inner-N
    [1, 3, 5, 6],      // 2  — sat-N-D    : sat-N-G + coin-NE + inner-N + inner-NE
    [2, 6, 13],        // 3  — coin-NE    : sat-N-D + inner-NE + coin-SE
    [0, 1, 5, 7],      // 4  — inner-NW   : coin-NW + sat-N-G + inner-N + inner-SW
    [1, 2, 4, 6, 8],   // 5  — inner-N    : sat-N-G + sat-N-D + inner-NW + inner-NE + inner-S
    [2, 3, 5, 9],      // 6  — inner-NE   : sat-N-D + coin-NE + inner-N + inner-SE
    [4, 8, 10, 11],    // 7  — inner-SW   : inner-NW + inner-S + coin-SW + sat-S-G
    [5, 7, 9, 11, 12], // 8  — inner-S    : inner-N + inner-SW + inner-SE + sat-S-G + sat-S-D
    [6, 8, 12, 13],    // 9  — inner-SE   : inner-NE + inner-S + sat-S-D + coin-SE
    [0, 7, 11],        // 10 — coin-SW    : coin-NW + inner-SW + sat-S-G
    [7, 8, 10, 12],    // 11 — sat-S-G    : inner-SW + inner-S + coin-SW + sat-S-D
    [8, 9, 11, 13],    // 12 — sat-S-D    : inner-S + inner-SE + sat-S-G + coin-SE
    [3, 9, 12],        // 13 — coin-SE    : coin-NE + inner-SE + sat-S-D
  ],

  // Positions visuelles (%) — symétrie 4 axes
  //
  //  [0]    [1]       [2]    [3]
  //       [4]   [5]  [6]
  //       [7]   [8]  [9]
  //  [10]   [11]    [12]  [13]
  //
  cellPositions: [
    { x:  8, y:  8 }, //  0 — coin-NW
    { x: 35, y:  8 }, //  1 — sat-N-gauche
    { x: 65, y:  8 }, //  2 — sat-N-droite
    { x: 92, y:  8 }, //  3 — coin-NE
    { x: 25, y: 35 }, //  4 — inner-NW
    { x: 50, y: 32 }, //  5 — inner-N  (hub)
    { x: 75, y: 35 }, //  6 — inner-NE
    { x: 25, y: 65 }, //  7 — inner-SW
    { x: 50, y: 68 }, //  8 — inner-S  (hub)
    { x: 75, y: 65 }, //  9 — inner-SE
    { x:  8, y: 92 }, // 10 — coin-SW
    { x: 35, y: 92 }, // 11 — sat-S-gauche
    { x: 65, y: 92 }, // 12 — sat-S-droite
    { x: 92, y: 92 }, // 13 — coin-SE
  ],

  backgroundAsset: require('../../assets/boards/fond.jpg'),

  availableElements: [
    'arbre', 'bucheron', 'ours', 'mouton', 'chien', 'loup',
    'ruche', 'cerf', 'biche', 'tas_buches', 'chalet',
  ],

  specialCells: {
    corners: [0, 3, 10, 13],
    center:  [4, 5, 6, 7, 8, 9],  // les 6 inner (dont 5 et 8 = hubs deg-5)
    edges:   [1, 2, 11, 12],
  },
};
