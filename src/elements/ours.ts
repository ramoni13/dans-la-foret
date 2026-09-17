import { ElementDefinition } from '../core/models/Element';

export const oursDef: ElementDefinition = {
  id: 'ours',
  label: 'Ours',
  icon: require('../../assets/elements/ours.png'),
  color: '#6B4226',
  maxPerBoard: 4,
  constraints: [
    {
      // Ne peut pas être voisin d'un autre ours
      type: 'neighbor_same',
      mode: 'forbid',
      scope: 'neighbor',
    },
  ],
};
