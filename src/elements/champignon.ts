import { ElementDefinition } from '../core/models/Element';

// ============================================================
// CHAMPIGNON
// Règle : ne peut pas être voisin d'un autre champignon.
//         Placement restreint aux cases centre uniquement
//         (specialCells.center du plateau).
//         Max 3 par plateau (topologiquement limité à 2 sur
//         board_15_daily car case 7 est voisine de toutes
//         les autres cases centre).
// ============================================================

export const champignonDef: ElementDefinition = {
  id: 'champignon',
  label: 'Champignon',
  icon: require('../../assets/elements/pastilles/champignon.png'),
  color: '#8B6914',
  maxPerBoard: 3,
  constraints: [
    {
      // Deux champignons ne peuvent pas être voisins
      type: 'neighbor_same',
      mode: 'forbid',
      scope: 'neighbor',
    },
  ],
  placementRules: [
    { type: 'center_only' }, // Uniquement sur specialCells.center
  ],
};
