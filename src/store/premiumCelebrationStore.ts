// ============================================================
// premiumCelebrationStore — modale de félicitations après l'achat premium
//
// `unlockPremium()` (playerStore) appelle `show()` : la modale est montée UNE fois à la racine
// (`app/_layout.tsx`), donc elle s'affiche quel que soit l'écran qui a lancé l'achat.
// Volontairement non persisté : la fête n'est jouée qu'au moment de l'achat.
// ============================================================

import { create } from 'zustand';

interface PremiumCelebrationState {
  visible: boolean;
  show: () => void;
  hide: () => void;
}

export const usePremiumCelebrationStore = create<PremiumCelebrationState>((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));
