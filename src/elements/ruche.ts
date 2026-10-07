import { ElementDefinition } from '../core/models/Element';

// ============================================================
// RUCHE
// Règle : un seul exemplaire max par défi (maxPerBoard = 1).
//         Tous les ours du plateau doivent être voisins directs de
//         la ruche — la contrainte est portée par l'ours, pas la ruche.
// ============================================================

export const rucheDef: ElementDefinition = {
  id: 'ruche',
  label: 'Ruche',
  icon: require('../../assets/elements/ruche.png'),
  color: '#F5A623',
  maxPerBoard: 1,
  constraints: [
    // La ruche n'a plus de contrainte de voisinage propre.
    // C'est l'ours qui porte la contrainte conditionnelle :
    // "si une ruche existe, je dois en être voisin".
  ],
};
