import { BoardDefinition } from '../core/models/Board';

// Topologie : extension du board 8 cases (board_8_v2) avec une case bas-centre
// Disposition :
//       [0]
//   [1]     [2]
//   [3]     [4]
//       [5]
//   [6]     [7]
//       [8]       ← NOUVELLE case bas-centre

export const board9cellsV1: BoardDefinition = {
  id: 'board_9_v1',
  label: 'Lisière Étendue',
  cellCount: 9,
  connections: [
    [1, 2, 5],       // case 0 — haut centre
    [0, 3],          // case 1 — gauche haut
    [0, 4],          // case 2 — droite haut
    [1, 4, 5, 6],    // case 3 — gauche milieu
    [2, 3, 5, 7],    // case 4 — droite milieu
    [0, 3, 4, 6, 7], // case 5 — centre milieu
    [3, 5, 8],       // case 6 — gauche bas (+8 vs board_8)
    [4, 5, 8],       // case 7 — droite bas (+8 vs board_8)
    [6, 7],          // case 8 — bas centre (NOUVELLE)
  ],
  cellPositions: [
    { x: 50, y: 12 }, // case 0 — haut centre
    { x: 25, y: 30 }, // case 1 — gauche haut
    { x: 75, y: 30 }, // case 2 — droite haut
    { x: 25, y: 52 }, // case 3 — gauche milieu
    { x: 75, y: 52 }, // case 4 — droite milieu
    { x: 50, y: 52 }, // case 5 — centre milieu
    { x: 25, y: 78 }, // case 6 — gauche bas
    { x: 75, y: 78 }, // case 7 — droite bas
    { x: 50, y: 93 }, // case 8 — bas centre (NOUVELLE)
  ],
  backgroundAsset: require('../../assets/boards/fond.jpg'),
  availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'cerf', 'biche', 'ruche'],
  specialCells: {
    corners: [0, 8],
    edges: [1, 2, 3, 4],
    center: [5, 6, 7],
  },
};
