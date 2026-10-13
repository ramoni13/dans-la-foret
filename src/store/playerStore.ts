// ============================================================
// STORE JOUEUR — Zustand
// Profil, progression, graines (monnaie), badges
// ============================================================

import { create } from 'zustand';
import { PlayerProfile, computePlayerLevel } from '../services/playerService';
import { Lang, getSystemLocale } from '../i18n/locale';
import { BonusId } from '../constants/bonus';

/** Type d'effet visuel en jeu (particules en arrière-plan) */
export type VisualEffect = 'leaves' | 'butterflies' | 'birds' | 'none';
import {
  BADGE_MAP,
  BADGE_SEED_REWARDS,
  RARITY_UNLOCKS,
} from '../constants/badges';
import { DEFAULT_BADGE_GOALS } from '../core/engine/badgeEngine';

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
  abandonCount: Record<string, number>; // challengeId → nb d'abandons cumulés
  // ── Nouveaux champs statistiques (chantier 5) ──────────────────────────────
  dailyPlayed: number;          // nb de défis du jour tentés (tous temps)
  dailyWon: number;             // nb de défis du jour réussis (tous temps)
  friendPlayed: number;         // nb de défis amis joués en tant que participant
  avgResolutionMs: number;      // moyenne glissante du temps de résolution solo
  totalResolutionCount: number; // nb de parties solo comptées dans la moyenne
  /**
   * Nb de victoires sous le seuil vitesse par badge.
   * Clés : 'vitesse_tortue' | 'vitesse_Loup' | 'vitesse_oiseau' | 'vitesse_eclair' | 'vitesse_tornade'
   * Le seuil est celui du niveau courant au moment de la partie.
   * Un badge est décerné quand le compteur atteint SPEED_BADGE_TARGET (5).
   */
  speedBadgeHits: Record<string, number>;
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
  unlockedBonuses: BonusId[];               // bonus débloqués via badges (instinct)
  unlockedThemes: string[];                 // thèmes débloqués via badges
  unlockedOnf: boolean;                     // mode ONF débloqué via badge bois×9 (chantier 3)
  badgeShowcase: [string?, string?, string?]; // 3 badges choisis pour la vitrine

  // ── Streak quotidien ────────────────────────────────────────────────────────
  dailyStreak: number;      // jours consécutifs joués
  lastPlayedDate: string;   // "YYYY-MM-DD" — date ISO de la dernière session de jeu

  // ── Tutoriels bonus ────────────────────────────────────────────────────────
  /** BonusId dont le joueur a coché "Ne plus me montrer" */
  bonusTutorialDismissed: BonusId[];

  // ── Effet visuel en jeu ─────────────────────────────────────────────────
  visualEffect: VisualEffect;

  // ── Défi journalier ────────────────────────────────────────────────────────
  dailyChallengeStreak: number;                                      // Jours consécutifs réussis (indépendant du streak normal)
  longestDailyChallengeStreak: number;                               // Meilleure série journalière (record historique)
  lastDailyChallengeDate: string;                                    // "YYYY-MM-DD" — date UTC du dernier défi journalier réussi
  dailyChallengeStatus: 'pending' | 'in_progress' | 'success' | 'failed' | null; // Statut du jour en cours
  dailyChallengeTimeMs: number | null;                               // Temps réalisé (ms) si success

  // ── Anti-triche : timestamps de début ────────────────────────────────────
  challengeStartedAt: Record<string, number>;   // challengeId → Date.now() de première ouverture

  // ── Notifications amis ─────────────────────────────────────────────────────
  /** Afficher le badge rouge sur l'onglet Amis quand un défi est en attente */
  friendNotifBadgeEnabled: boolean;

  // ── Mode ONF — Grille Forestière 4×4 ────────────────────────────────────────
  onfSolvedCount: number;        // nb de grilles 4×4 résolues
  lastOnfCompoKey: string | null; // clé de la dernière composition jouée (anti-répétition)

  // ── Badges : objectifs actifs (chantier 3) ───────────────────────────────────
  activeBadgeGoals: string[];  // max 3 badgeIds choisis par le joueur

  // ── Défis amis : amis uniques défiés (pour badge social_poignee / social_cirque) ──
  /** UIDs des amis à qui le joueur a envoyé au moins un défi. Jamais de doublons. */
  challengedFriendIds: string[];

  // ── Bonus journaliers (chantier 4) ───────────────────────────────────────────
  dailyBonusUses: Record<BonusId, number>; // utilisations restantes aujourd'hui
  lastBonusResetDate: string | null;        // "YYYY-MM-DD" du dernier reset

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
  setActiveBadgeGoals: (ids: string[]) => void;

  // ── Actions bonus journaliers (chantier 4) ───────────────────────────────────
  spendBonus: (bonusId: BonusId) => boolean;

  // ── Actions social ───────────────────────────────────────────────────────────
  recordFriendWin: () => void;
  /** Enregistre un défi envoyé à un ami (uniquement si c'est un nouvel ami).
   *  Met à jour challengedFriendIds et totalFriendsInvited. */
  recordFriendChallenged: (friendUid: string) => void;
  recordTopDEJ: () => void;

  // ── Actions tutoriels bonus ──────────────────────────────────────────────────
  dismissBonusTutorial: (bonusId: BonusId) => void;
  resetBonusTutorials: () => void;

  // ── Actions effet visuel ───────────────────────────────────────────────────
  setVisualEffect: (effect: VisualEffect) => void;

  // ── Action quotidienne ───────────────────────────────────────────────────────
  checkDailyLogin: () => boolean; // Retourne true si c'est la première connexion du jour

  // ── Actions défi journalier ─────────────────────────────────────────────────
  submitDailyResult: (date: string, success: boolean, timeMs?: number) => void;
  resetDailyStatus: () => void;

  // ── Actions anti-triche ───────────────────────────────────────────────────
  markChallengeStarted: (challengeId: string) => void;
  markChallengeAbandoned: (challengeId: string) => void;

  // ── Actions notifications amis ───────────────────────────────────────────
  setFriendNotifBadgeEnabled: (enabled: boolean) => void;

  // ── Actions mode ONF ─────────────────────────────────────────────────────
  incrementOnfSolved: () => void;
  setLastOnfCompoKey: (key: string) => void;

  // ── Actions statistiques génériques (chantier 5) ──────────────────────────
  incrementStat: (key: keyof PlayerStats, amount?: number) => void;
}

// ── Fonctions utilitaires anti-triche (hors store pour éviter stale closures) ─

/** Retourne le temps écoulé cumulé pour un défi (en ms). Appeler avec getState(). */
export function getChallengeElapsed(
  challengeStartedAt: Record<string, number>,
  challengeId: string,
): number {
  const startedAt = challengeStartedAt[challengeId];
  if (startedAt == null) return 0;
  return Date.now() - startedAt;
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
      if (unlock.unlock === 'music_unlock')         themes.push('music'); // chantier 3
    }
  }

  return themes;
}

/** Retourne true si le joueur a débloqué le mode ONF via le palier badge bois×9. */
function computeUnlockedONF(earnedBadges: string[]): boolean {
  const rarityCount: Record<string, number> = {};
  for (const id of earnedBadges) {
    const def = BADGE_MAP[id];
    if (!def) continue;
    rarityCount[def.rarity] = (rarityCount[def.rarity] ?? 0) + 1;
  }
  return RARITY_UNLOCKS.some(
    u => u.unlock === 'mode_onf' && (rarityCount[u.rarity] ?? 0) >= u.count
  );
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
    abandonCount: {},
    dailyPlayed: 0,
    dailyWon: 0,
    friendPlayed: 0,
    avgResolutionMs: 0,
    totalResolutionCount: 0,
    speedBadgeHits: {},
  },

  earnedBadges: [],
  unlockedBonuses: [],
  unlockedThemes: [],
  unlockedOnf: false,
  badgeShowcase: [undefined, undefined, undefined],

  dailyStreak: 0,
  lastPlayedDate: '',

  bonusTutorialDismissed: [],
  visualEffect: 'leaves' as VisualEffect,

  dailyChallengeStreak: 0,
  longestDailyChallengeStreak: 0,
  lastDailyChallengeDate: '',
  dailyChallengeStatus: null,
  dailyChallengeTimeMs: null,

  challengeStartedAt: {},

  friendNotifBadgeEnabled: true,

  onfSolvedCount: 0,
  lastOnfCompoKey: null,

  activeBadgeGoals: [...DEFAULT_BADGE_GOALS],

  challengedFriendIds: [],

  dailyBonusUses: { highlight_valid_cells: 5, instinct: 5 },
  lastBonusResetDate: null,

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
        abandonCount:             (profile.stats as any).abandonCount ?? {},
        dailyPlayed:              (profile.stats as any).dailyPlayed ?? 0,
        dailyWon:                 (profile.stats as any).dailyWon ?? 0,
        friendPlayed:             (profile.stats as any).friendPlayed ?? 0,
        avgResolutionMs:          (profile.stats as any).avgResolutionMs ?? 0,
        totalResolutionCount:     (profile.stats as any).totalResolutionCount ?? 0,
        speedBadgeHits:           (profile.stats as any).speedBadgeHits ?? {},
      },
      earnedBadges:    mergedEarned,
      unlockedBonuses: computeUnlockedBonuses(mergedEarned),
      unlockedThemes:  computeUnlockedThemes(mergedEarned),
      unlockedOnf:     computeUnlockedONF(mergedEarned),
      badgeShowcase:   (profile.badgeShowcase as [string?, string?, string?]) ?? [undefined, undefined, undefined],
      dailyStreak:       mergedDailyStreak,
      lastPlayedDate:    mergedLastPlayed,
      dailyChallengeStreak: Math.max(
        get().dailyChallengeStreak,
        (profile as any).dailyChallengeStreak ?? 0,
      ),
      longestDailyChallengeStreak: Math.max(
        get().longestDailyChallengeStreak,
        (profile as any).longestDailyChallengeStreak ?? 0,
      ),
      onfSolvedCount: (profile as any).onfSolvedCount ?? (profile as any).onf4x4SolvedCount ?? 0,
      // Objectifs actifs : restaurer depuis le cloud ; si vide (ancien profil), appliquer les défauts
      activeBadgeGoals: (() => {
        const cloudGoals: string[] = (profile as any).activeBadgeGoals ?? [];
        return cloudGoals.length > 0 ? cloudGoals : [...DEFAULT_BADGE_GOALS];
      })(),
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
    // Nombre de victoires sous seuil requis pour obtenir un badge vitesse
    const SPEED_BADGE_TARGET = 5;
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

      // Anti-triche : nettoyer le timestamp de début à la victoire
      const { [challengeId]: _s, ...restStarted } = state.challengeStartedAt;

      // Moyenne glissante du temps de résolution (chantier 5)
      const prevResCount = state.stats.totalResolutionCount;
      const newResolutionCount = prevResCount + 1;
      const newAvgResolutionMs = prevResCount === 0
        ? timeMs
        : Math.round((state.stats.avgResolutionMs * prevResCount + timeMs) / newResolutionCount);

      // speedBadgeHits : incrémenter le compteur de chaque badge vitesse si le seuil est battu
      const lvl = Math.max(1, state.currentLevel);
      const elapsedSec = timeMs / 1000;
      const speedThresholds: Array<[string, number]> = [
        ['vitesse_tortue',  30 + (lvl - 1) * 5],
        ['vitesse_Loup',    20 + (lvl - 1) * 3],
        ['vitesse_oiseau',  12 + (lvl - 1) * 2],
        ['vitesse_eclair',   7 + (lvl - 1) * 1],
        ['vitesse_tornade',  4 + (lvl - 1) * 0.5],
      ];
      const prevHits = state.stats.speedBadgeHits ?? {};
      const newSpeedHits = { ...prevHits };
      for (const [badgeId, threshold] of speedThresholds) {
        // N'incrémenter que si pas encore obtenu ET sous le seuil
        if (!state.earnedBadges.includes(badgeId) && elapsedSec < threshold) {
          const prev = prevHits[badgeId] ?? 0;
          if (prev < SPEED_BADGE_TARGET) {
            newSpeedHits[badgeId] = prev + 1;
          }
        }
      }

      return {
        completedChallenges: newCompleted,
        currentLevel: computePlayerLevel(newCompleted.length),
        friendChallengeTokens: tokenEarned
          ? state.friendChallengeTokens + 1
          : state.friendChallengeTokens,
        challengeStartedAt: restStarted,
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
          avgResolutionMs: newAvgResolutionMs,
          totalResolutionCount: newResolutionCount,
          speedBadgeHits: newSpeedHits,
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
    isAuthenticated: false,
    // authReady reste true : Firebase a déjà répondu, on sait qu'on est déconnecté
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
      abandonCount: {},
      dailyPlayed: 0,
      dailyWon: 0,
      friendPlayed: 0,
      avgResolutionMs: 0,
      totalResolutionCount: 0,
      speedBadgeHits: {},
    },
    earnedBadges: [],
    unlockedBonuses: [],
    unlockedThemes: [],
    unlockedOnf: false,
    badgeShowcase: [undefined, undefined, undefined],
    dailyStreak: 0,
    lastPlayedDate: '',
    dailyChallengeStreak: 0,
    longestDailyChallengeStreak: 0,
    lastDailyChallengeDate: '',
    dailyChallengeStatus: null,
    dailyChallengeTimeMs: null,
    challengeStartedAt: {},
    friendNotifBadgeEnabled: true,
    onfSolvedCount: 0,
    lastOnfCompoKey: null,
    activeBadgeGoals: [...DEFAULT_BADGE_GOALS],
    dailyBonusUses: { highlight_valid_cells: 5, instinct: 5 },
    lastBonusResetDate: null,
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

      // Retirer des objectifs actifs les badges nouvellement obtenus (chantier 3)
      const newActiveBadgeGoals = state.activeBadgeGoals.filter(
        id => !toAdd.includes(id)
      );

      return {
        earnedBadges:    newEarned,
        seeds:           state.seeds + totalSeeds,
        unlockedBonuses: newUnlockedBonuses,
        unlockedThemes:  newUnlockedThemes,
        unlockedOnf:     computeUnlockedONF(newEarned),
        activeBadgeGoals: newActiveBadgeGoals,
      };
    });
  },

  // ── setBadgeShowcase ──────────────────────────────────────
  setBadgeShowcase: (badges) => set({ badgeShowcase: badges }),

  // ── Social ────────────────────────────────────────────────
  recordFriendWin: () => set(state => ({
    stats: { ...state.stats, friendWins: state.stats.friendWins + 1 },
  })),

  recordFriendChallenged: (friendUid) => set(state => {
    // Ignorer si cet ami a déjà été défié (on ne compte que les nouveaux)
    if (state.challengedFriendIds.includes(friendUid)) return state;
    const newList = [...state.challengedFriendIds, friendUid];
    return {
      challengedFriendIds: newList,
      stats: { ...state.stats, totalFriendsInvited: newList.length },
    };
  }),

  recordTopDEJ: () => set(state => ({
    stats: { ...state.stats, topDEJCount: state.stats.topDEJCount + 1 },
  })),

  // ── checkDailyLogin ───────────────────────────────────────
  // Appelé au montage de l'app. Retourne true si c'est une nouvelle journée.
  checkDailyLogin: () => {
    const { lastPlayedDate, dailyStreak, lastBonusResetDate } = get();
    const today     = todayISO();
    const yesterday = yesterdayISO();

    // Reset des bonus journaliers si nouvelle journée (chantier 4)
    if (lastBonusResetDate !== today) {
      set({
        dailyBonusUses: { highlight_valid_cells: 5, instinct: 5 },
        lastBonusResetDate: today,
      });
    }

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

  // ── Tutoriels bonus ──────────────────────────────────────
  dismissBonusTutorial: (bonusId) => set(state => ({
    bonusTutorialDismissed: state.bonusTutorialDismissed.includes(bonusId)
      ? state.bonusTutorialDismissed
      : [...state.bonusTutorialDismissed, bonusId],
  })),

  resetBonusTutorials: () => set({ bonusTutorialDismissed: [] }),

  // ── Effet visuel ─────────────────────────────────────────
  setVisualEffect: (effect) => set({ visualEffect: effect }),

  // ── Défi journalier ────────────────────────────────────────
  submitDailyResult: (date, success, timeMs) => {
    set(state => {
      // Incrémenter les compteurs cumulatifs (chantier 5)
      const newDailyPlayed = state.stats.dailyPlayed + 1;
      const newDailyWon    = success ? state.stats.dailyWon + 1 : state.stats.dailyWon;

      if (success) {
        // Succès : incrémenter le streak si c'est le jour suivant, sinon reset à 1
        const isConsecutive = isNextDay(state.lastDailyChallengeDate, date);
        const newStreak = isConsecutive
          ? state.dailyChallengeStreak + 1
          : 1;
        const newLongest = Math.max(state.longestDailyChallengeStreak, newStreak);
        return {
          dailyChallengeStatus: 'success' as const,
          lastDailyChallengeDate: date,
          dailyChallengeStreak: newStreak,
          longestDailyChallengeStreak: newLongest,
          dailyChallengeTimeMs: timeMs ?? null,
          stats: { ...state.stats, dailyPlayed: newDailyPlayed, dailyWon: newDailyWon },
        };
      } else {
        // Échec : reset le streak mais on conserve le record
        return {
          dailyChallengeStatus: 'failed' as const,
          dailyChallengeStreak: 0,
          dailyChallengeTimeMs: null,
          stats: { ...state.stats, dailyPlayed: newDailyPlayed, dailyWon: newDailyWon },
        };
      }
    });
  },

  resetDailyStatus: () => set({ dailyChallengeStatus: null }),

  // ── Anti-triche : timestamps d'abandon ──────────────────────
  markChallengeStarted: (challengeId) => {
    set(state => {
      // Ne pas écraser si déjà enregistré (reprise après abandon)
      if (state.challengeStartedAt[challengeId] != null) return state;
      return {
        challengeStartedAt: {
          ...state.challengeStartedAt,
          [challengeId]: Date.now(),
        },
      };
    });
  },

  markChallengeAbandoned: (challengeId) => {
    set(state => {
      // Effacer challengeStartedAt pour ce défi : le chrono repartira de 0
      // lors de la prochaine tentative.
      const { [challengeId]: _s, ...restStarted } = state.challengeStartedAt;
      return {
        challengeStartedAt: restStarted,
        stats: {
          ...state.stats,
          abandonCount: {
            ...state.stats.abandonCount,
            [challengeId]: (state.stats.abandonCount[challengeId] ?? 0) + 1,
          },
        },
      };
    });
  },

  // ── Notifications amis ────────────────────────────────────
  setFriendNotifBadgeEnabled: (enabled) => set({ friendNotifBadgeEnabled: enabled }),

  // ── Mode ONF ──────────────────────────────────────────────
  incrementOnfSolved: () => set(state => ({
    onfSolvedCount: state.onfSolvedCount + 1,
  })),

  setLastOnfCompoKey: (key) => set({ lastOnfCompoKey: key }),

  // ── Objectifs de badges actifs (chantier 3) ───────────────
  setActiveBadgeGoals: (ids) => set({
    activeBadgeGoals: ids.slice(0, 3).filter((id, i, arr) => arr.indexOf(id) === i),
  }),

  // ── Dépense de bonus journalier (chantier 4) ──────────────
  spendBonus: (bonusId) => {
    const { isPremium, dailyBonusUses } = get();
    if (isPremium) return true; // Illimité en premium
    const remaining = dailyBonusUses[bonusId] ?? 0;
    if (remaining <= 0) return false;
    set(state => ({
      dailyBonusUses: {
        ...state.dailyBonusUses,
        [bonusId]: (state.dailyBonusUses[bonusId] ?? 0) - 1,
      },
    }));
    return true;
  },

  // ── Incrément générique de stat (chantier 5) ─────────────
  incrementStat: (key, amount = 1) => {
    set(state => ({
      stats: {
        ...state.stats,
        [key]: typeof state.stats[key] === 'number'
          ? (state.stats[key] as number) + amount
          : state.stats[key],
      },
    }));
  },
}));

// ── Helpers privés ────────────────────────────────────────────────────────────

/** Vérifie si dateB est le jour suivant de dateA (format "YYYY-MM-DD") */
function isNextDay(dateA: string, dateB: string): boolean {
  if (!dateA || !dateB) return false;
  const a = new Date(dateA + 'T00:00:00Z');
  const b = new Date(dateB + 'T00:00:00Z');
  const diffMs = b.getTime() - a.getTime();
  return diffMs === 86400000; // Exactement 1 jour
}
