import { ElementDefinition } from '../core/models/Element';

// ============================================================
// RUCHE
// Règle : doit être voisine d'au moins 1 ours (l'ours mange du miel).
//         Un seul exemplaire max par défi (maxPerBoard = 1).
//         Si plusieurs ours sur le plateau, 1 seul suffit à valider.
// ============================================================

export const rucheDef: ElementDefinition = {
  id: 'ruche',
  label: 'Ruche',
  icon: require('../../assets/elements/ruche.png'),
  color: '#F5A623',
  maxPerBoard: 1,
  constraints: [
    {
      // Doit être voisine d'au moins 1 ours
      type: 'neighbor_specific',
      targetElementId: 'ours',
      mode: 'require',
      scope: 'neighbor',
      minCount: 1,
    },
  ],
};
