import { ElementDefinition } from '../core/models/Element';

// ============================================================
// OURS
// Règle 1 : ne peut pas être voisin d'un autre ours (repulsion).
// Règle 2 : si une ruche est présente sur le plateau, chaque ours
//           doit être voisin direct de cette ruche.
//           (onlyIfTargetOnBoard = true → la contrainte ne s'applique
//           que si au moins 1 ruche existe sur le board)
// ============================================================

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
    {
      // Si une ruche est présente, chaque ours doit en être voisin
      type: 'neighbor_specific',
      targetElementId: 'ruche',
      mode: 'require',
      scope: 'neighbor',
      minCount: 1,
      onlyIfTargetOnBoard: true,
    },
  ],
};
