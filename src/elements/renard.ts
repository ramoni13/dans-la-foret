import { ElementDefinition } from '../core/models/Element';

export const renardDef: ElementDefinition = {
  id: 'renard',
  label: 'Renard',
  icon: require('../../assets/elements/renard.png'),
  color: '#FF6B35',
  maxPerBoard: 4,
  constraints: [
    {
      // Ne peut pas être voisin d'un autre renard
      type: 'neighbor_same',
      mode: 'forbid',
      scope: 'neighbor',
    },
    {
      // Ne peut pas être voisin d'un mouton
      type: 'neighbor_specific',
      targetElementId: 'mouton',
      mode: 'forbid',
      scope: 'neighbor',
    },
  ],
};
