import { ElementDefinition } from '../core/models/Element';

export const chaletDef: ElementDefinition = {
  id: 'chalet',
  label: 'Chalet',
  icon: require('../../assets/elements/chalet.png'),
  color: '#A0522D',
  maxPerBoard: 4,
  constraints: [
    {
      // Ne peut pas être voisin d'un autre chalet
      type: 'neighbor_same',
      mode: 'forbid',
      scope: 'neighbor',
    },
    {
      // DOIT avoir au moins un bucheron voisin
      type: 'neighbor_specific',
      targetElementId: 'bucheron',
      mode: 'require',
      scope: 'neighbor',
      minCount: 1,
    },
  ],
};
