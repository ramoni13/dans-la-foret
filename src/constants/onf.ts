// ============================================================
// CONSTANTES MODE ONF — Grille Forestière (Sudoku Forestier)
//
// Le DÉBLOCAGE du mode (et de ses trois paliers) n'est plus ici : il passe par
// `isFeatureAvailable('onf_sentier' | 'onf_clairiere' | 'onf_profonde')` (src/constants/unlocks.ts).
// La sélection des grilles par palier est dans src/constants/onfTiers.ts.
// Les restes du mode 3×3 (`ONF_UNLOCK_LEVEL`, `ONF_4X4_UNLOCK_COUNT`) ont été supprimés (Lot 5).
// ============================================================

/** Nombre de défis ONF réussis nécessaires pour débloquer une nouvelle carte de l'Herbier. */
export const ONF_CARD_UNLOCK_EVERY = 5;