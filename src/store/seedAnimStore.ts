// ============================================================
// seedAnimStore — Store Zustand pour l'animation de graines volantes
//
// Responsabilités :
//   1. Stocker la position absolue du compteur SeedsOverlay (mise à jour
//      par ForestFrame à chaque changement de dimension)
//   2. Permettre à VictoryModal de déclencher l'animation via `triggerFly`
//   3. Stocker le callback de pulse pour que VictoryModal puisse le réclamer
// ============================================================

import { create } from 'zustand';

interface SeedAnimState {
  /** Centre X absolu du compteur SeedsOverlay (coordonnées écran) */
  counterX: number;
  /** Centre Y absolu du compteur SeedsOverlay (coordonnées écran) */
  counterY: number;
  /** Mise à jour des coordonnées cibles (appelé par ForestFrame) */
  setCounterPosition: (x: number, y: number) => void;

  /** Déclencheur de l'animation : null = inactif, sinon config de vol */
  flyTrigger: { fromX: number; fromY: number; count: number } | null;
  /** Déclencher l'animation depuis n'importe quel composant */
  triggerFly: (fromX: number, fromY: number, count: number) => void;
  /** Réinitialiser après la fin de l'animation */
  clearFly: () => void;

  /** Callback de pulse à appeler quand toutes les particules sont arrivées */
  requestPulse: boolean;
  setPulse: (v: boolean) => void;
}

export const useSeedAnimStore = create<SeedAnimState>((set) => ({
  counterX: 0,
  counterY: 0,
  setCounterPosition: (x, y) => set({ counterX: x, counterY: y }),

  flyTrigger: null,
  triggerFly: (fromX, fromY, count) => set({ flyTrigger: { fromX, fromY, count } }),
  clearFly: () => set({ flyTrigger: null }),

  requestPulse: false,
  setPulse: (v) => set({ requestPulse: v }),
}));
