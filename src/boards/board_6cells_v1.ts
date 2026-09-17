import { BoardDefinition } from '../core/models/Board';

// Connexions vérifiées sur l'image fond_variante1.jpg
// Disposition :
//      [0]          ← coin haut gauche
//  [1] [2] [3]      ← rangée milieu
//      [4]          ← centre bas
//      [5]          ← bas

export const board6cellsV1: BoardDefinition = {
  id: 'board_6_v1',
  label: 'Clairière',
  cellCount: 6,
  connections: [
    [1, 3],       // case 0 : coin haut gauche
    [0, 2, 4, 5], // case 1 : gauche milieu
    [1, 3, 4],    // case 2 : centre milieu
    [0, 2, 4, 5], // case 3 : droite milieu
    [1, 2, 3],    // case 4 : centre bas
    [1, 3],       // case 5 : bas
  ],
  cellPositions: [
    { x: 50, y: 15 }, // case 0 — haut centre
    { x: 28, y: 42 }, // case 1 — gauche
    { x: 50, y: 35 }, // case 2 — centre haut
    { x: 72, y: 42 }, // case 3 — droite
    { x: 50, y: 58 }, // case 4 — centre bas
    { x: 50, y: 78 }, // case 5 — bas
  ],
  backgroundAsset: require('../../assets/boards/fond.jpg'),
  availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  specialCells: {
    center: [2, 4],
    corners: [0, 5],
    edges: [1, 3],
  },
};
