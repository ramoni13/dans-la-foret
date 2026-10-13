import { ElementDefinition } from '../core/models/Element';

// ============================================================
// ARBRE
// Règle 1 : tous les arbres du plateau doivent former UN SEUL
//           groupe connexe (comme le chien en meute).
//           Pas de sous-groupes séparés (2+2).
// Règle 2 : si des bûches (tas_buches) sont présentes sur le
//           plateau, elles doivent également faire partie du
//           même groupe connexe que les arbres.
//           Autrement dit, arbre + bûches forment ensemble
//           une seule forêt connexe mixte.
// ============================================================

export const arbreDef: ElementDefinition = {
  id: 'arbre',
  label: 'Arbre',
  icon: require('../../assets/elements/pastilles/arbre.png'),
  color: '#2E7D32',
  maxPerBoard: 6,
  constraints: [
    {
      // Tous les arbres (+ bûches si présentes) forment un seul groupe connexe
      type: 'connected_group_with',
      mode: 'require',
      scope: 'board',
      groupElementId: 'tas_buches',
    },
  ],
};
