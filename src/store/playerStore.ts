// ============================================================
// STORE JOUEUR — Zustand
// Profil, progression, graines (monnaie), badges
// ============================================================

import { create } from 'zustand';
import { PlayerProfile, computePlayerLevel } from '../services/playerService';
import { Lang, getSystemLocale } from '../i18n/locale';
import { BonusId } from '../constants/bonus';
import {
  BADGE_MAP,
  BADGE_SEED_REWARDS,
  RARITY_UNLOCKS,
} from '../constants/badges';

// ── Helpers de date ────────────────────────────────────────────────────────────

/** Retourne la date ISO "YYYY-MM-DD" d'aujourd'hui en heure locale */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Retourne la date ISO d'hier */
function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlayerStats {
  totalSolved: number;
  bestTimes: Record<string, number>; // challengeId → meilleur temps (ms)
  currentStreak: number;             // streak per-challenge (hérité, incrémenté à chaque défi)
  longestStreak: number;
  noErrorStreak: number;             // défis CONSÉCUTIFS sans AUCUN échec (failCount=0 à la victoire)
  friendWins: number;                // victoires contre amis (cumulé)
  totalFriendsInvited: number;       // amis invités (cumulé)
  topDEJCount: number;               // fois dans le top 3 du défi du jour
  sameChallengePlays: Record<string, number>; // challengeId → nb de fois joué
  failCount: Record<string, number>; // challengeId → nb d'échecs (validation ratée) pendant la partie en cours
  improvedChallengesCount: number;   // nb de défis différents dont le temps a été amélioré
  seasonalChallengesPlayed: number;  // défis joués pendant la saison en cours
}

interface PlayerState {
  // ── État d'authentification (mis à jour par _layout.tsx uniquement) ──────────
  authReady: boolean;        // true = Firebase a répondu
  isAuthenticated: boolean;  // true = connecté et non anonyme

  userId: string | null;
  username: string;
  seeds: number;
  completedChallenges: string[];
  isPremium: boolean;
  lastPlayedChallengeId: string | null;
  friendChallengeTokens: number;

  stats: PlayerStats;

  language: Lang;

  // Niveau courant du joueur (calculé depuis completedChallenges.length)
  currentLevel: number;

  // ── Badges ──────────────────────────────────────────────────────────────────
  earnedBadges: string[];                   // IDs des badges obtenus
  unlockedBonuses: BonusId[];               // bonus débloqués via badges (instinct, flash)
  unlockedThemes: string[];                 // thèmes débloqués via badges
  badgeShowcase: [string?, string?, string?]; // 3 badges choisis pour la vitrine

  // ── Streak quotidien ────────────────────────────────────────────────────────
  dailyStreak: number;      // jours consécutifs joués
  lastPlayedDate: string;   // "YYYY-MM-DD" — date ISO de la dernière session de jeu

  // ── Actions de base ─────────────────────────────────────────────────────────
  setAuthState: (ready: boolean, authenticated: boolean) => void;
  setUser: (userId: string, username: string) => void;
  setLanguage: (lang: Lang) => void;
  restoreFromCloud: (profile: PlayerProfile) => void;
  addSeeds: (amount: number) => void;
  spendSeeds: (amount: number) => boolean;
  addFriendChallengeToken: () => void;
  spendFriendChallengeToken: () => boolean;
  markChallengeCompleted: (
    challengeId: string,
    timeMs: number,
    errorCount: number
  ) => void;
  recordChallengeFailure: (challengeId: string) => void;
  setLastPlayed: (challengeId: string) => void;
  unlockPremium: () => void;
  logout: () => void;

  // ── Actions badges ───────────────────────────────────────────────────────────
  awardBadge: (badgeId: string) => void;
  /** Attribue plusieurs badges en UN SEUL set() — évite la cascade de re-renders */
  awardBadges: (badgeIds: string[]) => void;
  setBadgeShowcase: (badges: [string?, string?, string?]) => void;

  // ── Actions social ───────────────────────────────────────────────────────────
  recordFriendWin: () => void;
  recordFriendInvited: () => void;
  recordTopDEJ: () => void;

  // ── Action quotidienne ───────────────────────────────────────────────────────
  checkDailyLogin: () => boolean; // Retourne true si c'est la première connexion du jour
}

// ── Calcul des bonus/thèmes débloqués depuis les badges ──────────────────────

function computeUnlockedBonuses(earnedBadges: string[]): BonusId[] {
  const bonuses: BonusId[] = [];
  const rarityCount: Record<string, number> = {};

  for (const id of earnedBadges) {
    const def = BADGE_MAP[id];
    if (!def) continue;
    rarityCount[def.rarity] = (rarityCount[def.rarity] ?? 0) + 1;
  }

  for (const unlock of RARITY_UNLOCKS) {
    const count = rarityCount[unlock.rarity] ?? 0;
    if (count >= unlock.count) {
      if (unlock.unlock === 'bonus_instinct') bonuses.push('instinct');
      if (unlock.unlock === 'bonus_flash')    bonuses.push('flash');
    }
  }

  return bonuses;
}

function computeUnlockedThemes(earnedBadges: string[]): string[] {
  const themes: string[] = [];
  const rarityCount: Record<string, number> = {};

  for (const id of earnedBadges) {
    const def = BADGE_MAP[id];
    if (!def) continue;
    rarityCount[def.rarity] = (rarityCount[def.rarity] ?? 0) + 1;
  }

  for (const unlock of RARITY_UNLOCKS) {
    const count = rarityCount[unlock.rarity] ?? 0;
    if (count >= unlock.count) {
      if (unlock.unlock === 'theme_automne')        themes.push('automne');
      if (unlock.unlock === 'theme_hiver')          themes.push('hiver');
      if (unlock.unlock === 'theme_foret_mystique') themes.push('foret_mystique');
    }
  }

  return themes;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const usePlayerStore = create<PlayerState>((set, get) => ({
  authReady: false,
  isAuthenticated: false,

  userId: null,
  username: 'Joueur',
  seeds: 99,                        // 99 graines pour les tests — TODO: passer à 3 avant publication
  completedChallenges: [],
  isPremium: true,                  // TODO: passer à false avant publication
  lastPlayedChallengeId: null,
  friendChallengeTokens: 3,

  language: getSystemLocale(),

  currentLevel: computePlayerLevel(0),

  stats: {
    totalSolved: 0,
    bestTimes: {},
    currentStreak: 0,
    longestStreak: 0,
    noErrorStreak: 0,
    friendWins: 0,
    totalFriendsInvited: 0,
    topDEJCount: 0,
    sameChallengePlays: {},
    failCount: {},
    improvedChallengesCount: 0,
    seasonalChallengesPlayed: 0,
  },

  earnedBadges: [],
  unlockedBonuses: [],
  unlockedThemes: [],
  badgeShowcase: [undefined, undefined, undefined],

  dailyStreak: 0,
  lastPlayedDate: '',

  // ── setAuthState ──────────────────────────────────────────
  setAuthState: (ready, authenticated) => set({ authReady: ready, isAuthenticated: authenticated }),

  // ── setUser ───────────────────────────────────────────────
  setUser: (userId, username) => set({ userId, username }),

  // ── setLanguage ───────────────────────────────────────────
  setLanguage: (lang) => set({ language: lang }),

  // ── Jetons ami ────────────────────────────────────────────
  addFriendChallengeToken: () => set(state => ({
    friendChallengeTokens: state.friendChallengeTokens + 1,
  })),

  spendFriendChallengeToken: () => {
    const { friendChallengeTokens } = get();
    if (friendChallengeTokens <= 0) return false;
    set(state => ({ friendChallengeTokens: state.friendChallengeTokens - 1 }));
    return true;
  },

  // ── restoreFromCloud ──────────────────────────────────────
  // Fait un UNION des badges locaux + cloud pour ne jamais perdre
  // un badge obtenu localement (hors-ligne) non encore synchronisé.
  // Exception : si le profil cloud est vierge (nouveau compte), on ne merge
  // pas les badges locaux pour éviter de contaminer un nouveau compte avec
  // les données d'une session de test précédente.
  restoreFromCloud: (profile) => {
    const cloudEarned = profile.earnedBadges ?? [];
    const isNewCloudProfile =
      cloudEarned.length === 0 &&
      (profile.completedChallenges ?? []).length === 0;

    // Union : merge badges locaux actuels + badges cloud,
    // SAUF si le profil cloud est vierge (nouveau compte).
    const localEarned = get().earnedBadges;
    const mergedEarned = isNewCloudProfile
      ? cloudEarned
      : Array.from(new Set([...localEarned, ...cloudEarned]));

    // Prendre le dailyStreak le plus élevé (le local peut être + récent que le cloud)
    // Sauf pour un profil vierge : on repart de zéro pour éviter de récupérer
    // le streak d'une session précédente sur un autre compte.
    const localDailyStreak    = get().dailyStreak;
    const localLastPlayedDate = get().lastPlayedDate;
    const cloudDailyStreak    = profile.dailyStreak ?? 0;
    const cloudLastPlayedDate = profile.lastPlayedDate ?? '';

    // Prendre le plus récent lastPlayedDate (ou cloud uniquement si profil vierge)
    const mergedLastPlayed = isNewCloudProfile
      ? cloudLastPlayedDate
      : (localLastPlayedDate >= cloudLastPlayedDate
          ? localLastPlayedDate
          : cloudLastPlayedDate);

    // Si le local est plus récent, conserver son streak ; sinon prendre le cloud
    // Profil vierge → streak cloud (0)
    const mergedDailyStreak = isNewCloudProfile
      ? cloudDailyStreak
      : (localLastPlayedDate >= cloudLastPlayedDate
          ? Math.max(localDailyStreak, cloudDailyStreak)
          : cloudDailyStreak);

    set({
      userId: profile.userId,
      username: profile.username,
      seeds: profile.seeds,
      completedChallenges: profile.completedChallenges,
      isPremium: profile.isPremium,
      currentLevel: computePlayerLevel(profile.completedChallenges?.length ?? 0),
      stats: {
        totalSolved:              profile.stats.totalSolved,
        bestTimes:                profile.stats.bestTimes,
        currentStreak:            profile.stats.currentStreak,
        longestStreak:            profile.stats.longestStreak,
        noErrorStreak:            profile.stats.noErrorStreak ?? 0,
        friendWins:               profile.stats.friendWins ?? 0,
        totalFriendsInvited:      profile.stats.totalFriendsInvited ?? 0,
        topDEJCount:              profile.stats.topDEJCount ?? 0,
        sameChallengePlays:       profile.stats.sameChallengePlays ?? {},
        failCount:                profile.stats.failCount ?? {},
        improvedChallengesCount:  profile.stats.improvedChallengesCount ?? 0,
        seasonalChallengesPlayed: profile.stats.seasonalChallengesPlayed ?? 0,
      },
      earnedBadges:    mergedEarned,
      unlockedBonuses: computeUnlockedBonuses(mergedEarned),
      unlockedThemes:  computeUnlockedThemes(mergedEarned),
      badgeShowcase:   (profile.badgeShowcase as [string?, string?, string?]) ?? [undefined, undefined, undefined],
      dailyStreak:     mergedDailyStreak,
      lastPlayedDate:  mergedLastPlayed,
    });
  },

  // ── Graines ───────────────────────────────────────────────
  addSeeds: (amount) => set(state => ({ seeds: state.seeds + amount })),

  spendSeeds: (amount) => {
    const { seeds } = get();
    if (seeds < amount) return false;
    set(state => ({ seeds: state.seeds - amount }));
    return true;
  },

  // ── markChallengeCompleted ─────────────────────────────────
  // failCountForThisGame = nb de fois où le joueur a tapé "Valider" et échoué
  // pendant CETTE partie (avant la victoire finale).
  // noErrorStreak s'incrémente seulement si failCountForThisGame === 0.
  markChallengeCompleted: (challengeId, timeMs, errorCount) => {
    set(state => {
      const alreadyCompleted = state.completedChallenges.includes(challengeId);
      const prevBest = state.stats.bestTimes[challengeId];
      const newBest  = prevBest !== undefined ? Math.min(prevBest, timeMs) : timeMs;
      const improved = prevBest !== undefined && timeMs < prevBest;

      const newCompleted = alreadyCompleted
        ? state.completedChallenges
        : [...state.completedChallenges, challengeId];

      // Jeton défi ami : 1 jeton tous les 5 défis complétés
      const prevCount   = state.completedChallenges.length;
      const newCount    = newCompleted.length;
      const tokenEarned = !alreadyCompleted && Math.floor(newCount / 5) > Math.floor(prevCount / 5);

      // noErrorStreak : incrémente seulement si la partie s'est terminée
      // sans AUCUN bouton Valider raté (failCount[challengeId] === 0).
      // errorCount ici = failCount accumulé pendant la partie (passé depuis [challengeId].tsx)
      const hadFailures  = errorCount > 0;
      const newNoErrorStreak = hadFailures ? 0 : state.stats.noErrorStreak + 1;

      // sameChallengePlays
      const plays    = state.stats.sameChallengePlays;
      const newPlays = {
        ...plays,
        [challengeId]: (plays[challengeId] ?? 0) + 1,
      };

      // improvedChallengesCount
      const newImproved = improved
        ? state.stats.improvedChallengesCount + 1
        : state.stats.improvedChallengesCount;

      // Réinitialiser failCount pour ce défi après succès
      const newFailCount = { ...state.stats.failCount };
      delete newFailCount[challengeId];

      // seasonalChallengesPlayed : incrémente toujours (une partie = une saison)
      const newSeasonalCount = state.stats.seasonalChallengesPlayed + 1;

      return {
        completedChallenges: newCompleted,
        currentLevel: computePlayerLevel(newCompleted.length),
        friendChallengeTokens: tokenEarned
          ? state.friendChallengeTokens + 1
          : state.friendChallengeTokens,
        stats: {
          ...state.stats,
          totalSolved: alreadyCompleted ? state.stats.totalSolved : state.stats.totalSolved + 1,
          bestTimes: { ...state.stats.bestTimes, [challengeId]: newBest },
          currentStreak: state.stats.currentStreak + 1,
          longestStreak: Math.max(state.stats.longestStreak, state.stats.currentStreak + 1),
          noErrorStreak: newNoErrorStreak,
          sameChallengePlays: newPlays,
          improvedChallengesCount: newImproved,
          failCount: newFailCount,
          seasonalChallengesPlayed: newSeasonalCount,
        },
      };
    });
  },

  // ── recordChallengeFailure ────────────────────────────────
  recordChallengeFailure: (challengeId) => {
    set(state => ({
      stats: {
        ...state.stats,
        noErrorStreak: 0, // Échec = reset streak précision
        failCount: {
          ...state.stats.failCount,
          [challengeId]: (state.stats.failCount[challengeId] ?? 0) + 1,
        },
      },
    }));
  },

  // ── setLastPlayed ─────────────────────────────────────────
  setLastPlayed: (challengeId) => set({ lastPlayedChallengeId: challengeId }),

  // ── unlockPremium ─────────────────────────────────────────
  unlockPremium: () => set({ isPremium: true }),

  // ── logout ────────────────────────────────────────────────
  logout: () => set({
    userId: null,
    username: 'Joueur',
    seeds: 3,
    completedChallenges: [],
    isPremium: false,
    lastPlayedChallengeId: null,
    friendChallengeTokens: 0,
    currentLevel: 1,
    stats: {
      totalSolved: 0,
      bestTimes: {},
      currentStreak: 0,
      longestStreak: 0,
      noErrorStreak: 0,
      friendWins: 0,
      totalFriendsInvited: 0,
      topDEJCount: 0,
      sameChallengePlays: {},
      failCount: {},
      improvedChallengesCount: 0,
      seasonalChallengesPlayed: 0,
    },
    earnedBadges: [],
    unlockedBonuses: [],
    unlockedThemes: [],
    badgeShowcase: [undefined, undefined, undefined],
    dailyStreak: 0,
    lastPlayedDate: '',
  }),

  // ── awardBadge ────────────────────────────────────────────
  // Délègue à awardBadges pour centraliser la logique (un seul set)
  awardBadge: (badgeId) => {
    usePlayerStore.getState().awardBadges([badgeId]);
  },

  // ── awardBadges ───────────────────────────────────────────
  // Version groupée : UN SEUL set() pour N badges.
  // Élimine la cascade de re-renders causée par des appels awardBadge() répétés.
  awardBadges: (badgeIds) => {
    if (badgeIds.length === 0) return;
    set(state => {
      // Filtrer les badges déjà obtenus (idempotence)
      const toAdd = badgeIds.filter(id => !state.earnedBadges.includes(id));
      if (toAdd.length === 0) return state;

      // Cumuler les graines de tous les nouveaux badges en une passe
      const totalSeeds = toAdd.reduce((acc, id) => {
        const def = BADGE_MAP[id];
        return acc + (def ? BADGE_SEED_REWARDS[def.rarity] : 0);
      }, 0);

      const newEarned = [...state.earnedBadges, ...toAdd];

      // Recalculer les bonus/thèmes UNE SEULE FOIS pour tous les badges
      const newUnlockedBonuses = computeUnlockedBonuses(newEarned);
      const newUnlockedThemes  = computeUnlockedThemes(newEarned);

      return {
        earnedBadges:    newEarned,
        seeds:           state.seeds + totalSeeds,
        unlockedBonuses: newUnlockedBonuses,
        unlockedThemes:  newUnlockedThemes,
      };
    });
  },

  // ── setBadgeShowcase ──────────────────────────────────────
  setBadgeShowcase: (badges) => set({ badgeShowcase: badges }),

  // ── Social ────────────────────────────────────────────────
  recordFriendWin: () => set(state => ({
    stats: { ...state.stats, friendWins: state.stats.friendWins + 1 },
  })),

  recordFriendInvited: () => set(state => ({
    stats: { ...state.stats, totalFriendsInvited: state.stats.totalFriendsInvited + 1 },
  })),

  recordTopDEJ: () => set(state => ({
    stats: { ...state.stats, topDEJCount: state.stats.topDEJCount + 1 },
  })),

  // ── checkDailyLogin ───────────────────────────────────────
  // Appelé au montage de l'app. Retourne true si c'est une nouvelle journée.
  checkDailyLogin: () => {
    const { lastPlayedDate, dailyStreak } = get();
    const today     = todayISO();
    const yesterday = yesterdayISO();

    if (lastPlayedDate === today) return false; // Déjà compté aujourd'hui

    let newStreak: number;
    if (lastPlayedDate === yesterday) {
      // Jours consécutifs → streak+1
      newStreak = dailyStreak + 1;
    } else {
      // Rupture → remise à 1
      newStreak = 1;
    }

    set({ dailyStreak: newStreak, lastPlayedDate: today });
    return true; // Première connexion de la journée
  },
}));
