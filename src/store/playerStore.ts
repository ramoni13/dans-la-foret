// ============================================================
// STORE JOUEUR — Zustand
// Profil, progression, graines (monnaie)
// ============================================================

import { create } from 'zustand';
import { PlayerProfile } from '../services/playerService';

interface PlayerStats {
  totalSolved: number;
  bestTimes: Record<string, number>; // challengeId → meilleur temps (ms)
  currentStreak: number;
  longestStreak: number;
}

interface PlayerState {
  userId: string | null;
  username: string;
  seeds: number;                     // Monnaie virtuelle
  completedChallenges: string[];     // IDs des défis complétés
  isPremium: boolean;
  lastPlayedChallengeId: string | null; // Dernier défi joué (pour "Reprendre")
  friendChallengeTokens: number;     // Jetons pour lancer un défi ami

  stats: PlayerStats;

  // Actions
  setUser: (userId: string, username: string) => void;
  restoreFromCloud: (profile: PlayerProfile) => void;
  addSeeds: (amount: number) => void;
  spendSeeds: (amount: number) => boolean;
  addFriendChallengeToken: () => void;
  spendFriendChallengeToken: () => boolean;
  markChallengeCompleted: (challengeId: string, timeMs: number) => void;
  setLastPlayed: (challengeId: string) => void;
  unlockPremium: () => void;
  logout: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  userId: null,
  username: 'Joueur',
  seeds: 99,                         // 99 graines pour les tests
  completedChallenges: [],
  isPremium: true,                   // TODO: passer à false avant publication
  lastPlayedChallengeId: null,
  friendChallengeTokens: 3,          // 3 jetons offerts au démarrage (tests)

  stats: {
    totalSolved: 0,
    bestTimes: {},
    currentStreak: 0,
    longestStreak: 0,
  },

  setUser: (userId, username) => set({ userId, username }),

  addFriendChallengeToken: () => set(state => ({
    friendChallengeTokens: state.friendChallengeTokens + 1,
  })),

  spendFriendChallengeToken: () => {
    const { friendChallengeTokens } = get();
    if (friendChallengeTokens <= 0) return false;
    set(state => ({ friendChallengeTokens: state.friendChallengeTokens - 1 }));
    return true;
  },

  restoreFromCloud: (profile) => set({
    userId: profile.userId,
    username: profile.username,
    seeds: profile.seeds,
    completedChallenges: profile.completedChallenges,
    isPremium: profile.isPremium,
    stats: {
      totalSolved: profile.stats.totalSolved,
      bestTimes: profile.stats.bestTimes,
      currentStreak: profile.stats.currentStreak,
      longestStreak: profile.stats.longestStreak,
    },
  }),

  addSeeds: (amount) => set(state => ({ seeds: state.seeds + amount })),

  spendSeeds: (amount) => {
    const { seeds } = get();
    if (seeds < amount) return false;
    set(state => ({ seeds: state.seeds - amount }));
    return true;
  },

  markChallengeCompleted: (challengeId, timeMs) => {
    set(state => {
      const alreadyCompleted = state.completedChallenges.includes(challengeId);
      const prevBest = state.stats.bestTimes[challengeId];
      const newBest = prevBest ? Math.min(prevBest, timeMs) : timeMs;
      const newCompleted = alreadyCompleted
        ? state.completedChallenges
        : [...state.completedChallenges, challengeId];

      // Jeton défi ami : 1 jeton tous les 5 défis complétés
      const prevCount = state.completedChallenges.length;
      const newCount = newCompleted.length;
      const tokenEarned = !alreadyCompleted && Math.floor(newCount / 5) > Math.floor(prevCount / 5);

      return {
        completedChallenges: newCompleted,
        friendChallengeTokens: tokenEarned
          ? state.friendChallengeTokens + 1
          : state.friendChallengeTokens,
        stats: {
          ...state.stats,
          totalSolved: alreadyCompleted ? state.stats.totalSolved : state.stats.totalSolved + 1,
          bestTimes: { ...state.stats.bestTimes, [challengeId]: newBest },
          currentStreak: state.stats.currentStreak + 1,
          longestStreak: Math.max(state.stats.longestStreak, state.stats.currentStreak + 1),
        },
      };
    });
  },

  setLastPlayed: (challengeId) => set({ lastPlayedChallengeId: challengeId }),

  unlockPremium: () => set({ isPremium: true }),

  logout: () => set({
    userId: null,
    username: 'Joueur',
    seeds: 3,
    completedChallenges: [],
    isPremium: false,
    lastPlayedChallengeId: null,
    friendChallengeTokens: 0,
    stats: { totalSolved: 0, bestTimes: {}, currentStreak: 0, longestStreak: 0 },
  }),
}));
