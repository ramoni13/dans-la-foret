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
  /** Nombre de défis amis en attente — alimente le badge rouge sur l'onglet Défis */
  pendingFriendChallenges: number;
  setPendingFriendChallenges: (count: number) => void;
  /** Nombre de slots d'objectif badge libres (0–3) — alimente le badge rouge sur l'onglet Profil */
  goalSlotsToFill: number;
  setGoalSlotsToFill: (count: number) => void;
}

export const useNavStore = create<NavState>((set) => ({
  backLabel: null,
  onBack:    null,
  showBack: (onBack, label = '← Retour') => set({ onBack, backLabel: label }),
  hideBack: () => set({ onBack: null, backLabel: null }),
  pendingFriendChallenges: 0,
  setPendingFriendChallenges: (count) => set({ pendingFriendChallenges: count }),
  goalSlotsToFill: 0,
  setGoalSlotsToFill: (count) => set({ goalSlotsToFill: count }),
}));
