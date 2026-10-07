import { BoardDefinition } from '../core/models/Board';

// ============================================================
// PLATEAU JOURNALIER — Clairière Secrète (15 cases)
//
// Disposition :
//      [0]──────────────[1]──────────────[2]          ← Couronne Nord
//       |\               |                |
//       | \              |                |
//      [5] [3]          [7]             [4] [6]       ← Bords + Centre intérieur haut
//       |   |          / | \             |   |
//       |   |        /   |   \           |   |
//      [8] [10]────/    [13]   \────[11] | [9]        ← Bords + Centre intérieur bas
//       |   |          / | \         |   |
//       |   |        /   |   \       |   |
//     [12]──|──────/     |     \─────|──[14]          ← Couronne Sud
//
// 5 cases CENTRE (champignon autorisé) : 3, 4, 7, 10, 11
// 10 cases COURONNE (bord de forêt)    : 0, 1, 2, 5, 6, 8, 9, 12, 13, 14
//
// Case 7 = hub central (6 voisins), connecté aux 4 autres cases centre
// Symétrie gauche-droite (axe 1, 7, 13) :
//   0 ↔ 2, 3 ↔ 4, 5 ↔ 6, 8 ↔ 9, 10 ↔ 11, 12 ↔ 14
// ============================================================

export const board15cellsDaily: BoardDefinition = {
  id: 'board_15_daily',
  label: 'Clairière Secrète',
  cellCount: 15,
  connections: [
    [1, 3, 5],           // case 0  — Couronne (coin NW)
    [0, 2, 7],           // case 1  — Couronne (nord-centre)
    [1, 4, 6],           // case 2  — Couronne (coin NE)
    [0, 5, 7, 10],       // case 3  — Centre (intérieur haut-gauche)
    [2, 6, 7, 11],       // case 4  — Centre (intérieur haut-droite)
    [0, 3, 8],           // case 5  — Couronne (bord gauche haut)
    [2, 4, 9],           // case 6  — Couronne (bord droite haut)
    [1, 3, 4, 10, 11, 13], // case 7  — Centre (hub central, 6 voisins)
    [5, 10, 12],         // case 8  — Couronne (bord gauche bas)
    [6, 11, 14],         // case 9  — Couronne (bord droite bas)
    [3, 7, 8, 12],       // case 10 — Centre (intérieur bas-gauche)
    [4, 7, 9, 14],       // case 11 — Centre (intérieur bas-droite)
    [8, 10, 13],         // case 12 — Couronne (coin SW)
    [7, 12, 14],         // case 13 — Couronne (sud-centre)
    [9, 11, 13],         // case 14 — Couronne (coin SE)
  ],
  cellPositions: [
    { x: 12, y: 5  },   // case 0  — Coin nord-ouest
    { x: 50, y: 5  },   // case 1  — Nord-centre
    { x: 88, y: 5  },   // case 2  — Coin nord-est
    { x: 30, y: 28 },   // case 3  — Centre intérieur haut-gauche
    { x: 70, y: 28 },   // case 4  — Centre intérieur haut-droite
    { x: 8,  y: 30 },   // case 5  — Bord gauche haut
    { x: 92, y: 30 },   // case 6  — Bord droite haut
    { x: 50, y: 38 },   // case 7  — Centre absolu (hub)
    { x: 8,  y: 62 },   // case 8  — Bord gauche bas
    { x: 92, y: 62 },   // case 9  — Bord droite bas
    { x: 30, y: 62 },   // case 10 — Centre intérieur bas-gauche
    { x: 70, y: 62 },   // case 11 — Centre intérieur bas-droite
    { x: 12, y: 90 },   // case 12 — Coin sud-ouest
    { x: 50, y: 90 },   // case 13 — Sud-centre
    { x: 88, y: 90 },   // case 14 — Coin sud-est
  ],
  backgroundAsset: require('../../assets/boards/fond.jpg'),
  availableElements: [
    'bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard',
    'ruche', 'cerf', 'biche', 'tas_buches', 'champignon',
  ],
  specialCells: {
    corners: [0, 2, 12, 14],
    center:  [3, 4, 7, 10, 11],
    edges:   [1, 5, 6, 8, 9, 13],
  },
};
