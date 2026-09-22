import { BoardDefinition } from '../core/models/Board';

// Connexions vérifiées sur l'image fond_variante2.jpg
// Disposition réelle (y=52 pour cases 3, 4 ET 5) :
//         [0]          x=50, y=12
//    [1]       [2]           y=30
//    [3]  [5]  [4]           y=52  — 5 est entre 3 et 4, pas de lien direct 3↔4
//    [6]---[7]               y=78  — 6↔7 connectés (asymétrie)

export const board8cellsV2: BoardDefinition = {
  id: 'board_8_v2',
  label: 'Lisière',
  cellCount: 8,
  connections: [
    [1, 2, 5],       // case 0 : haut centre
    [0, 3],          // case 1 : gauche haut
    [0, 4],          // case 2 : droite haut
    [1, 5, 6],       // case 3 : gauche milieu  — PAS de lien direct vers 4
    [2, 5, 7],       // case 4 : droite milieu  — PAS de lien direct vers 3
    [0, 3, 4, 6, 7], // case 5 : centre milieu (hub)
    [3, 5, 7],       // case 6 : gauche bas — connectée à 7
    [4, 5, 6],       // case 7 : droite bas — connectée à 6
  ],
  cellPositions: [
    { x: 50, y: 12 }, // case 0 — haut centre
    { x: 25, y: 30 }, // case 1 — gauche haut
    { x: 75, y: 30 }, // case 2 — droite haut
    { x: 25, y: 52 }, // case 3 — gauche milieu
    { x: 75, y: 52 }, // case 4 — droite milieu
    { x: 50, y: 62 }, // case 5 — centre milieu (plus bas pour ne pas couper la ligne 3↔4)
    { x: 25, y: 78 }, // case 6 — gauche bas
    { x: 75, y: 78 }, // case 7 — droite bas
  ],
  backgroundAsset: require('../../assets/boards/fond.jpg'),
  availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
  specialCells: {
    corners: [0, 6, 7],
    edges: [1, 2, 3, 4],
    center: [5],
  },
};
