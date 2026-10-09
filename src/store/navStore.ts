// ============================================================
// navStore — état de navigation pour le bouton Retour
//
// Utilisé pour afficher un bouton "← Retour" dans ForestFrame
// (au-dessus du PNG du cadre) quand une sous-section est active.
// ============================================================

import { create } from 'zustand';

interface NavState {
  /** Libellé du bouton retour (null = pas de bouton) */
  backLabel: string | null;
  /** Callback à appeler quand le bouton retour est pressé */
  onBack: (() => void) | null;
  /** Montre le bouton retour */
  showBack: (onBack: () => void, label?: string) => void;
  /** Masque le bouton retour */
  hideBack: () => void;
}

export const useNavStore = create<NavState>((set) => ({
  backLabel: null,
  onBack:    null,
  showBack: (onBack, label = '← Retour') => set({ onBack, backLabel: label }),
  hideBack: () => set({ onBack: null, backLabel: null }),
}));
