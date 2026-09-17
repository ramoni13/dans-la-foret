import { ElementDefinition } from '../core/models/Element';

export const chienDef: ElementDefinition = {
  id: 'chien',
  label: 'Chien',
  icon: require('../../assets/elements/chien.png'),
  color: '#D2691E',
  maxPerBoard: 4,
  constraints: [
    {
      // DOIT être voisin d'au moins un autre chien (meute)
      type: 'neighbor_same',
      mode: 'require',
      scope: 'neighbor',
      minCount: 1,
    },
  ],
};
