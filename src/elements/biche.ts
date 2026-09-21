import { ElementDefinition } from '../core/models/Element';

// ============================================================
// BICHE
// Règle : ne peut pas être voisine d'une autre biche (forbid same).
//         Doit être voisine d'exactement 1 cerf (paired_specific).
//         Le nombre de biches doit être égal au nombre de cerfs.
//         Ex : 2 biches + 2 cerfs → 2 couples distincts.
// ============================================================

export const bicheDef: ElementDefinition = {
  id: 'biche',
  label: 'Biche',
  icon: require('../../assets/elements/biche.png'),
  color: '#C8A96E',
  maxPerBoard: 4,
  constraints: [
    {
      // Deux biches ne peuvent pas être voisines
      type: 'neighbor_same',
      mode: 'forbid',
      scope: 'neighbor',
    },
    {
      // Couplage 1-pour-1 avec le cerf :
      // chaque biche doit être voisine d'exactement 1 cerf,
      // et le nombre de biches doit être égal au nombre de cerfs.
      type: 'paired_specific',
      targetElementId: 'cerf',
      mode: 'require',
      scope: 'board',
    },
  ],
};
