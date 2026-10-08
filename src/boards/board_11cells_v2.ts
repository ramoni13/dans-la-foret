import { BoardDefinition } from '../core/models/Board';

// Nouvelle disposition — map lisible avec connexions claires (niveaux 9, 10, 11)
//
// Disposition :
//   [0]           [1]      ← coins haut-gauche / haut-droite
//         [2]              ← haut-centre (hub)
//   [3]   [4]   [5]        ← milieu-haut-gauche, CENTRE (hub), milieu-haut-droite
//   [6]         [7]        ← milieu-bas-gauche, milieu-bas-droite
//         [8]              ← bas-centre (hub)
//   [9]         [10]       ← coins bas-gauche / bas-droite
//
// Connexions :
//   [0] → [2, 3]                      coin HG vers haut-centre + milieu-haut-gauche
//   [1] → [2, 5]                      coin HD vers haut-centre + milieu-haut-droite
//   [2] → [0, 1, 3, 5]                haut-centre vers coins + milieu-haut G/D
//   [3] → [0, 2, 4, 6]                milieu-haut-gauche vers coin HG + centre + milieu-bas-gauche
//   [4] → [3, 5, 6, 7]                centre (hub) vers les 4 voisins directs
//   [5] → [1, 2, 4, 7]                milieu-haut-droite vers coin HD + centre + milieu-bas-droite
//   [6] → [3, 4, 8, 9]                milieu-bas-gauche vers centre + bas-centre + coin BG
//   [7] → [4, 5, 8, 10]               milieu-bas-droite vers centre + bas-centre + coin BD
//   [8] → [6, 7, 9, 10]               bas-centre vers milieu-bas G/D + coins bas
//   [9] → [6, 8]                      coin bas-gauche
//   [10] → [7, 8]                     coin bas-droite

export const board11cellsV2: BoardDefinition = {
  id: 'board_11_v2',
  label: 'Sous-bois Profond',
  cellCount: 11,
  connections: [
    [2, 3],       // case 0  — coin haut-gauche (2 voisins)
    [2, 5],       // case 1  — coin haut-droite (2 voisins)
    [0, 1, 3, 5], // case 2  — haut-centre (hub, 4 voisins)
    [0, 2, 4, 6], // case 3  — milieu-haut-gauche (4 voisins)
    [3, 5, 6, 7], // case 4  — centre (hub, 4 voisins)
    [1, 2, 4, 7], // case 5  — milieu-haut-droite (4 voisins)
    [3, 4, 8, 9], // case 6  — milieu-bas-gauche (4 voisins)
    [4, 5, 8, 10],// case 7  — milieu-bas-droite (4 voisins)
    [6, 7, 9, 10],// case 8  — bas-centre (hub, 4 voisins)
    [6, 8],       // case 9  — coin bas-gauche (2 voisins)
    [7, 8],       // case 10 — coin bas-droite (2 voisins)
  ],
  cellPositions: [
    { x: 12, y: 8  }, // case 0  — coin haut-gauche
    { x: 88, y: 8  }, // case 1  — coin haut-droite
    { x: 50, y: 20 }, // case 2  — haut-centre
    { x: 25, y: 38 }, // case 3  — milieu-haut-gauche
    { x: 50, y: 50 }, // case 4  — centre (hub)
    { x: 75, y: 38 }, // case 5  — milieu-haut-droite
    { x: 25, y: 62 }, // case 6  — milieu-bas-gauche
    { x: 75, y: 62 }, // case 7  — milieu-bas-droite
    { x: 50, y: 78 }, // case 8  — bas-centre
    { x: 12, y: 92 }, // case 9  — coin bas-gauche
    { x: 88, y: 92 }, // case 10 — coin bas-droite
  ],
  backgroundAsset: require('../../assets/boards/fond.jpg'),
  availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'cerf', 'biche', 'loup', 'ruche', 'tas_buches'],
  specialCells: {
    corners: [0, 1, 9, 10],
    center:  [4],
    edges:   [2, 3, 5, 6, 7, 8],
  },
};
