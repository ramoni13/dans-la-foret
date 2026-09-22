import { BoardDefinition } from '../core/models/Board';

export const board12cells: BoardDefinition = {
  id: 'board_12',
  label: 'Forêt Profonde',
  cellCount: 12,
  connections: [
    [1, 3, 4, 10],  // case 0
    [0, 2, 5, 11],  // case 1
    [1, 3, 4, 9],   // case 2
    [0, 2, 5, 8],   // case 3
    [0, 2, 6, 7],   // case 4
    [1, 3, 6, 7],   // case 5
    [4, 5, 8, 10],  // case 6
    [4, 5, 9, 11],  // case 7
    [3, 6, 9, 11],  // case 8
    [2, 7, 8, 10],  // case 9
    [0, 6, 9, 11],  // case 10
    [1, 7, 8, 10],  // case 11
  ],
  cellPositions: [
    { x: 7,  y: 5  }, // case 0  — coin haut gauche  (écarté)
    { x: 93, y: 5  }, // case 1  — coin haut droite  (écarté)
    { x: 35, y: 22 }, // case 2  — haut gauche intérieur
    { x: 65, y: 22 }, // case 3  — haut droite intérieur
    { x: 20, y: 40 }, // case 4  — milieu gauche haut
    { x: 80, y: 40 }, // case 5  — milieu droite haut
    { x: 20, y: 62 }, // case 6  — milieu gauche bas
    { x: 80, y: 62 }, // case 7  — milieu droite bas
    { x: 35, y: 78 }, // case 8  — bas gauche intérieur
    { x: 65, y: 78 }, // case 9  — bas droite intérieur
    { x: 7,  y: 93 }, // case 10 — coin bas gauche  (écarté)
    { x: 93, y: 93 }, // case 11 — coin bas droite  (écarté)
  ],
  backgroundAsset: require('../../assets/boards/fond.jpg'),
  availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  specialCells: {
    corners: [0, 1, 10, 11],
    edges: [2, 3, 4, 5, 6, 7, 8, 9],
  },
};
