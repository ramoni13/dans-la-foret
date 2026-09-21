import { ElementDefinition } from '../core/models/Element';

// ============================================================
// TAS DE BÛCHES
// Règle principale  : doit être voisin d'au moins 1 bucheron.
//                     Plusieurs tas peuvent partager le même bucheron.
// Règle conditionnelle : si un chalet est présent sur le plateau,
//                     le tas de bûches doit aussi être voisin de ce chalet.
//                     (Il fait le lien entre le bucheron et le chalet.)
// Note : la contrainte chalet→bucheron reste indépendante et toujours active.
// ============================================================

export const tasBuchesDef: ElementDefinition = {
  id: 'tas_buches',
  label: 'Tas de bûches',
  icon: require('../../assets/elements/tas_buches.png'),
  color: '#6D4C2A',
  maxPerBoard: 4,
  constraints: [
    {
      // Doit être voisin d'un bucheron TOUJOURS
      // + voisin d'un chalet SI chalet présent sur le plateau
      type: 'neighbor_specific_chain',
      targetElementId: 'bucheron',
      chainTargetElementId: 'chalet',
      mode: 'require',
      scope: 'neighbor',
    },
  ],
};
