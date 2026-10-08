import { ElementDefinition } from '../core/models/Element';

export const renardDef: ElementDefinition = {
  id: 'loup',
  label: 'Loup',
  icon: require('../../assets/elements/pastilles/loup.png'),
  color: '#FF6B35',
  maxPerBoard: 4,
  constraints: [
    {
      // Ne peut pas être voisin d'un autre loup
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
