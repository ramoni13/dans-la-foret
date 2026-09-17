// ============================================================
// STORE MODE DÉFI ENTRE AMIS — Zustand
// ============================================================

import { create } from 'zustand';
import { FriendChallenge } from '../core/models/FriendChallenge';

interface ChallengeState {
  activeChallenges: FriendChallenge[];   // Défis en attente de réponse
  completedChallenges: FriendChallenge[]; // Défis terminés
  currentFriendChallenge: FriendChallenge | null;

  // Actions
  setActiveChallenges: (challenges: FriendChallenge[]) => void;
  addChallenge: (challenge: FriendChallenge) => void;
  setCurrentFriendChallenge: (challenge: FriendChallenge | null) => void;
  completeChallenge: (challengeId: string, timeMs: number, bonusUsed: string[]) => void;
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  activeChallenges: [],
  completedChallenges: [],
  currentFriendChallenge: null,

  setActiveChallenges: (challenges) => set({ activeChallenges: challenges }),

  addChallenge: (challenge) => set(state => ({
    activeChallenges: [...state.activeChallenges, challenge],
  })),

  setCurrentFriendChallenge: (challenge) => set({ currentFriendChallenge: challenge }),

  completeChallenge: (challengeId, timeMs, bonusUsed) => {
    set(state => {
      const challenge = state.activeChallenges.find(c => c.id === challengeId);
      if (!challenge) return state;

      const updated: FriendChallenge = {
        ...challenge,
        challenged: {
          ...challenge.challenged,
          completionTime: timeMs,
          bonusUsed,
          completedAt: new Date().toISOString(),
          status: 'completed',
        },
      };

      return {
        activeChallenges: state.activeChallenges.filter(c => c.id !== challengeId),
        completedChallenges: [...state.completedChallenges, updated],
      };
    });
  },
}));
