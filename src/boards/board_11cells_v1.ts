import { BoardDefinition } from '../core/models/Board';

// Topologie : extension du board 10 cases (board_10_v3) avec une case centre absolu
// Disposition :
//   [0]       [1]       [2]    ← rangée haute (coins gauche, centre, droite)
//         [3]                  ← hub haut
//   [4]   [10]   [5]           ← milieu (10 = centre absolu, NOUVELLE)
//         [6]                  ← hub bas
//   [7]       [8]       [9]    ← rangée basse (coins gauche, centre, droite)

export const board11cellsV1: BoardDefinition = {
  id: 'board_11_v1',
  label: 'Sous-bois Profond',
  cellCount: 11,
  connections: [
    [3],                // case 0 — coin haut gauche
    [4, 5],             // case 1 — haut centre
    [3],                // case 2 — coin haut droite
    [0, 2, 4, 5, 6, 10], // case 3 — hub haut (+10 vs board_10)
    [1, 3, 6, 8, 10],  // case 4 — milieu gauche (+10 vs board_10)
    [1, 3, 6, 8, 10],  // case 5 — milieu droite (+10 vs board_10)
    [3, 4, 5, 7, 9, 10], // case 6 — hub bas (+10 vs board_10)
    [6],                // case 7 — coin bas gauche
    [4, 5],             // case 8 — bas centre
    [6],                // case 9 — coin bas droite
    [3, 4, 5, 6],       // case 10 — centre absolu (NOUVELLE)
  ],
  cellPositions: [
    { x: 12, y: 7  }, // case 0 — coin haut gauche
    { x: 50, y: 7  }, // case 1 — haut centre
    { x: 88, y: 7  }, // case 2 — coin haut droite
    { x: 50, y: 27 }, // case 3 — hub haut
    { x: 28, y: 46 }, // case 4 — milieu gauche
    { x: 72, y: 46 }, // case 5 — milieu droite
    { x: 50, y: 65 }, // case 6 — hub bas
    { x: 12, y: 91 }, // case 7 — coin bas gauche
    { x: 50, y: 91 }, // case 8 — bas centre
    { x: 88, y: 91 }, // case 9 — coin bas droite
    { x: 50, y: 46 }, // case 10 — centre absolu (NOUVELLE)
  ],
  backgroundAsset: require('../../assets/boards/fond.jpg'),
  availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'cerf', 'biche', 'renard', 'ruche', 'tas_buches'],
  specialCells: {
    corners: [0, 2, 7, 9],
    center: [3, 6, 10],
    edges: [1, 4, 5, 8],
  },
};
