import { ElementDefinition } from '../core/models/Element';

// ============================================================
// CHIEN
// Règle 1 : doit être voisin d'au moins 1 autre chien (meute).
// Règle 2 : tous les chiens du plateau doivent former UN SEUL
//           groupe connexe. Pas de sous-groupes séparés (2+2).
//           Ex : 4 chiens en 2 paires séparées → invalide.
// ============================================================

export const chienDef: ElementDefinition = {
  id: 'chien',
  label: 'Chien',
  icon: require('../../assets/elements/chien.png'),
  color: '#D2691E',
  maxPerBoard: 4,
  constraints: [
    {
      // Chaque chien doit avoir au moins 1 voisin chien
      type: 'neighbor_same',
      mode: 'require',
      scope: 'neighbor',
      minCount: 1,
    },
    {
      // Tous les chiens forment un seul groupe connexe
      type: 'connected_group',
      mode: 'require',
      scope: 'board',
    },
  ],
};
