import { ElementDefinition } from '../core/models/Element';

export const moutonDef: ElementDefinition = {
  id: 'mouton',
  label: 'Mouton',
  icon: require('../../assets/elements/pastilles/mouton.png'),
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
      // Ne peut pas être voisin d'un loup
      type: 'neighbor_specific',
      targetElementId: 'loup',
      mode: 'forbid',
      scope: 'neighbor',
    },
  ],
};
