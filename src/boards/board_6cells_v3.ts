import { BoardDefinition } from '../core/models/Board';

export const board6cellsV3: BoardDefinition = {
  id: 'board_6_v3',
  label: 'Sous-bois',
  cellCount: 6,
  connections: [
    [1, 3],         // case 0
    [0, 2, 4, 5],   // case 1
    [1, 3, 4],      // case 2
    [0, 2, 4, 5],   // case 3
    [1, 2, 3],      // case 4
    [1, 3],         // case 5
  ],
  cellPositions: [
    { x: 43, y: 8 }, // case 0
    { x: 19, y: 42 }, // case 1
    { x: 43, y: 29 }, // case 2
    { x: 66, y: 42 }, // case 3
    { x: 43, y: 56 }, // case 4
    { x: 43, y: 78 }, // case 5
  ],
  backgroundAsset: require('../../assets/boards/fond_6cells_v3.jpg'),
  availableElements: ['bucheron', 'ours', 'mouton', 'chien', 'chalet', 'renard'],
};
