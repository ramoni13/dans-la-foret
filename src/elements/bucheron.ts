import { ElementDefinition } from '../core/models/Element';

export const bucheronDef: ElementDefinition = {
  id: 'bucheron',
  label: 'Bucheron',
  icon: require('../../assets/elements/bucheron.png'),
  color: '#8B4513',
  maxPerBoard: 4,
  constraints: [
    {
      // Ne peut pas être voisin d'un autre bucheron
      type: 'neighbor_same',
      mode: 'forbid',
      scope: 'neighbor',
    },
  ],
};
