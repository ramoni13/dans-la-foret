import { ElementDefinition } from '../core/models/Element';

export const moutonDef: ElementDefinition = {
  id: 'mouton',
  label: 'Mouton',
  icon: require('../../assets/elements/mouton.png'),
  color: '#90A4AE', // Gris-ardoise — distinct du gris UI 'désactivé' (#D7CCC8)
  maxPerBoard: 4,
  constraints: [
    {
      // Ne peut pas être voisin d'un autre mouton
      type: 'neighbor_same',
      mode: 'forbid',
      scope: 'neighbor',
    },
    {
      // Ne peut pas être voisin d'un renard
      type: 'neighbor_specific',
      targetElementId: 'renard',
      mode: 'forbid',
      scope: 'neighbor',
    },
  ],
};
