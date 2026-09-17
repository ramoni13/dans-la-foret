import { BoardDefinition } from '../core/models/Board';

// Connexions vérifiées sur l'image fond_variante3.jpg
// Disposition :
//   [0]       [1]       [2]    ← rangée haute (coins gauche, centre, droite)
//         [3]                  ← centre haut
//   [4]       [5]              ← centre milieu gauche/droite
//         [6]                  ← centre bas
//   [7]       [8]       [9]    ← rangée basse (coins gauche, centre, droite)
//
// Connexions exactes (lues sur l'image) :
// 0 → [3]
// 1 → [4, 5]
// 2 → [3]
// 3 → [0, 2, 4, 5, 6]
// 4 → [1, 3, 6, 8]
// 5 → [1, 3, 6, 8]
// 6 → [3, 4, 5, 7, 9]
// 7 → [6]
// 8 → [4, 5]
// 9 → [6]

export const board10cellsV3: BoardDefinition = {
  id: 'board_10_v3',
  label: 'Sous-bois',
  cellCount: 10,
  connections: [
    [3],          // case 0 — coin haut gauche
    [4, 5],       // case 1 — haut centre
    [3],          // case 2 — coin haut droite
    [0, 2, 4, 5, 6], // case 3 — centre haut (nœud central haut)
    [1, 3, 6, 8], // case 4 — milieu gauche
    [1, 3, 6, 8], // case 5 — milieu droite
    [3, 4, 5, 7, 9], // case 6 — centre bas (nœud central bas)
    [6],          // case 7 — coin bas gauche
    [4, 5],       // case 8 — bas centre
    [6],          // case 9 — coin bas droite
  ],
  cellPositions: [
    { x: 15, y: 12 }, // case 0 — coin haut gauche
    { x: 50, y: 12 }, // case 1 — haut centre
    { x: 85, y: 12 }, // case 2 — coin haut droite
    { x: 50, y: 32 }, // case 3 — centre haut
    { x: 25, y: 52 }, // case 4 — milieu gauche
    { x: 75, y: 52 }, // case 5 — milieu droite
    { x: 50, y: 68 }, // case 6 — centre bas
    { x: 15, y: 85 }, // case 7 — coin bas gauche
    { x: 50, y: 85 }, // case 8 — bas centre
    { x: 85, y: 85 }, // case 9 — coin bas droite
  ],
  backgroundAsset: require('../../assets/boards/fond.jpg'),
  availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  specialCells: {
    corners: [0, 2, 7, 9],
    center: [3, 6],
    edges: [1, 4, 5, 8],
  },
};
