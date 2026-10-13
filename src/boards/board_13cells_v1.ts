import { BoardDefinition } from '../core/models/Board';

// ============================================================
// PLATEAU 13 CASES — Cœur de la Forêt (niveaux 16-17-18)
//
// Structure : 4 coins + 8 satellites + 1 centre
//
//  Numérotation (0-indexed) :
//    0  = coin NW  (haut-gauche extrême)
//    1  = satellite NW-haut
//    2  = satellite NW-bas
//    3  = coin NE  (haut-droite extrême)
//    4  = satellite NE-haut
//    5  = satellite NE-bas
//    6  = coin SW  (bas-gauche extrême)
//    7  = satellite SW-haut
//    8  = satellite SW-bas
//    9  = coin SE  (bas-droite extrême)
//   10  = satellite SE-haut
//   11  = satellite SE-bas
//   12  = CENTRE (hub central, 8 voisins)
//
//  Connexions satellites (hors centre) :
//    0 ─ 6   (côté gauche : coin NW ↔ coin SW)
//    3 ─ 9   (côté droite : coin NE ↔ coin SE)
//    1 ─ 2   (paire NW : NW-haut ↔ NW-bas)
//    4 ─ 5   (paire NE : NE-haut ↔ NE-bas)
//    7 ─ 8   (paire SW : SW-haut ↔ SW-bas)
//   10 ─ 11  (paire SE : SE-haut ↔ SE-bas)
//
// ============================================================

export const board13cellsV1: BoardDefinition = {
  id: 'board_13_v1',
  label: 'Cœur de la Forêt',
  cellCount: 13,
  connections: [
    [1, 2, 6],                       // case 0  — coin NW : sat NW-haut + sat NW-bas + coin SW
    [0, 2, 12],                      // case 1  — sat NW-haut : coin NW + sat NW-bas + centre
    [0, 1, 12],                      // case 2  — sat NW-bas  : coin NW + sat NW-haut + centre
    [4, 5, 9],                       // case 3  — coin NE : sat NE-haut + sat NE-bas + coin SE
    [3, 5, 12],                      // case 4  — sat NE-haut : coin NE + sat NE-bas + centre
    [3, 4, 12],                      // case 5  — sat NE-bas  : coin NE + sat NE-haut + centre
    [0, 7, 8],                       // case 6  — coin SW : coin NW + sat SW-haut + sat SW-bas
    [6, 8, 12],                      // case 7  — sat SW-haut : coin SW + sat SW-bas + centre
    [6, 7, 12],                      // case 8  — sat SW-bas  : coin SW + sat SW-haut + centre
    [3, 10, 11],                     // case 9  — coin SE : coin NE + sat SE-haut + sat SE-bas
    [9, 11, 12],                     // case 10 — sat SE-haut : coin SE + sat SE-bas + centre
    [9, 10, 12],                     // case 11 — sat SE-bas  : coin SE + sat SE-haut + centre
    [1, 2, 4, 5, 7, 8, 10, 11],     // case 12 — CENTRE (8 voisins)
  ],
  //
  // Positions visuelles (%) — symétrie 4 axes :
  //
  //   [0]            [1]   [4]            [3]
  //          [2]                   [5]
  //
  //                      [12]
  //
  //          [7]                  [10]
  //   [6]            [8]   [11]           [9]
  //
  cellPositions: [
    { x: 8,  y: 18 }, // 0  — coin NW
    { x: 30, y: 8  }, // 1  — sat NW-haut
    { x: 20, y: 38 }, // 2  — sat NW-bas
    { x: 92, y: 18 }, // 3  — coin NE
    { x: 70, y: 8  }, // 4  — sat NE-haut
    { x: 80, y: 38 }, // 5  — sat NE-bas
    { x: 8,  y: 82 }, // 6  — coin SW
    { x: 30, y: 92 }, // 7  — sat SW-haut
    { x: 20, y: 62 }, // 8  — sat SW-bas
    { x: 92, y: 82 }, // 9  — coin SE
    { x: 70, y: 92 }, // 10 — sat SE-haut
    { x: 80, y: 62 }, // 11 — sat SE-bas
    { x: 50, y: 50 }, // 12 — CENTRE
  ],
  backgroundAsset: require('../../assets/boards/fond.jpg'),
  availableElements: [
    'bucheron', 'ours', 'mouton', 'chien', 'loup',
    'ruche', 'cerf', 'biche', 'tas_buches', 'chalet',
  ],
  specialCells: {
    corners: [0, 3, 6, 9],
    center:  [2, 5, 8, 11, 12],
    edges:   [1, 4, 7, 10],
  },
};
