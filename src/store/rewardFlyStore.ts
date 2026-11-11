// ============================================================
// rewardFlyStore — Store Zustand des récompenses volantes (Progression v2, C7)
//
// Généralise l'ancien `seedAnimStore` : une récompense (graine 🌱 ou étoile ⭐) vole vers
// SON compteur dans le bandeau (`ForestFrame`). Deux cibles : 'seeds' | 'stars'.
//
// Responsabilités :
//   1. Stocker la position absolue (coordonnées écran) de chaque compteur du bandeau,
//      alimentée par ForestFrame à chaque changement de dimension ;
//   2. Pulser un compteur (halo + rebond) quand une récompense arrive ;
//   3. Déclencher un vol depuis n'importe quel composant (`triggerFly`).
//
// Les composants qui ont leur PROPRE compteur dans une modale (VictoryModal,
// DailyRouletteModal, friend-challenge) utilisent `RewardFly` directement avec des
// coordonnées locales ; le store sert au compteur du bandeau.
// ============================================================

import { create } from 'zustand';

/** Cible d'une récompense volante. */
export type RewardTarget = 'seeds' | 'stars';

export interface CounterPosition {
  /** Centre X absolu (coordonnées écran). */
  x: number;
  /** Centre Y absolu (coordonnées écran). */
  y: number;
}

export interface FlyTrigger {
  target: RewardTarget;
  fromX: number;
  fromY: number;
  count: number;
}

interface RewardFlyState {
  /** Positions des compteurs du bandeau, null tant que ForestFrame ne les a pas mesurées. */
  counters: Record<RewardTarget, CounterPosition | null>;
  setCounterPosition: (target: RewardTarget, x: number, y: number) => void;

  /** Vol en cours (null = inactif). */
  flyTrigger: FlyTrigger | null;
  triggerFly: (target: RewardTarget, fromX: number, fromY: number, count: number) => void;
  clearFly: () => void;

  /**
   * Compteur d'impulsions par cible : incrémenté à chaque arrivée de récompense.
   * Le compteur du bandeau écoute sa valeur pour jouer son rebond.
   */
  pulses: Record<RewardTarget, number>;
  requestPulse: (target: RewardTarget) => void;
}

export const useRewardFlyStore = create<RewardFlyState>((set) => ({
  counters: { seeds: null, stars: null },
  setCounterPosition: (target, x, y) =>
    set(state => {
      const prev = state.counters[target];
      // Évite un re-render si la position n'a pas bougé (onLayout peut se répéter).
      if (prev && prev.x === x && prev.y === y) return state;
      return { counters: { ...state.counters, [target]: { x, y } } };
    }),

  flyTrigger: null,
  triggerFly: (target, fromX, fromY, count) => set({ flyTrigger: { target, fromX, fromY, count } }),
  clearFly: () => set({ flyTrigger: null }),

  pulses: { seeds: 0, stars: 0 },
  requestPulse: (target) =>
    set(state => ({ pulses: { ...state.pulses, [target]: state.pulses[target] + 1 } })),
}));
