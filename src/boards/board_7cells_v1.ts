import { BoardDefinition } from '../core/models/Board';

// Disposition :
//      [0]          ← haut centre
//  [1]     [2]      ← milieu haut gauche/droite
//      [3]          ← centre (hub)
//  [4]     [5]      ← milieu bas gauche/droite
//      [6]          ← bas centre

export const board7cellsV1: BoardDefinition = {
  id: 'board_7_v1',
  label: 'Clairière',
  cellCount: 7,
  connections: [
    [1, 2],           // case 0 — haut centre
    [0, 3, 4],        // case 1 — milieu haut gauche
    [0, 3, 5],        // case 2 — milieu haut droite
    [1, 2, 4, 5],     // case 3 — centre (hub)
    [1, 3, 6],        // case 4 — milieu bas gauche
    [2, 3, 6],        // case 5 — milieu bas droite
    [4, 5],           // case 6 — bas centre
  ],
  cellPositions: [
    { x: 50, y: 10 }, // case 0 — haut centre
    { x: 25, y: 32 }, // case 1 — milieu haut gauche
    { x: 75, y: 32 }, // case 2 — milieu haut droite
    { x: 50, y: 50 }, // case 3 — centre (hub)
    { x: 25, y: 68 }, // case 4 — milieu bas gauche
    { x: 75, y: 68 }, // case 5 — milieu bas droite
    { x: 50, y: 88 }, // case 6 — bas centre
  ],
  backgroundAsset: require('../../assets/boards/fond.jpg'),
  availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  specialCells: {
    corners: [0, 6],
    edges: [1, 2, 4, 5],
    center: [3],
  },
};
