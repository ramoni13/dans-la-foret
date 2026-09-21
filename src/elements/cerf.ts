import { ElementDefinition } from '../core/models/Element';

// ============================================================
// CERF
// Règle : ne peut pas être voisin d'un autre cerf (forbid same).
//         Doit être voisin d'exactement 1 biche (paired_specific).
//         Le nombre de cerfs doit être égal au nombre de biches.
//         Ex : 2 cerfs + 2 biches → 2 couples distincts.
// ============================================================

export const cerfDef: ElementDefinition = {
  id: 'cerf',
  label: 'Cerf',
  icon: require('../../assets/elements/cerf.png'),
  color: '#8B6914',
  maxPerBoard: 4,
  constraints: [
    {
      // Deux cerfs ne peuvent pas être voisins
      type: 'neighbor_same',
      mode: 'forbid',
      scope: 'neighbor',
    },
    {
      // Couplage 1-pour-1 avec la biche :
      // chaque cerf doit être voisin d'exactement 1 biche,
      // et le nombre de cerfs doit être égal au nombre de biches.
      type: 'paired_specific',
      targetElementId: 'biche',
      mode: 'require',
      scope: 'board',
    },
  ],
};
