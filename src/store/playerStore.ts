// ============================================================
// STORE JOUEUR — Zustand
// Profil, progression, graines (monnaie), badges
// ============================================================

import { create } from 'zustand';
import { PlayerProfile, computePlayerLevel } from '../services/playerService';
import { Lang, getSystemLocale } from '../i18n/locale';
import { BonusId } from '../constants/bonus';
import { PROGRESSION_V2 } from '../constants/featureFlags';
import {
  CURRENT_PROGRESSION_VERSION,
  StarRating,
  StarResult,
  applyStarResult,
  computeLevelProgress,
  mergeChallengeStars,
  mergeRewardedChapters,
  getChaptersToReward,
  sumChapterSeeds,
  Chapter,
  computeStars,
  resolvePlayerLevel,
} from '../constants/progression';
import { createDefaultProgressionFields, createDefaultStats } from '../constants/profileDefaults';
import { CompletedDuel, StatsLike, mergeStats, tallyNewDuels } from '../constants/playerStats';
import type { DailyLeague } from '../constants/dailyLeagues';
import {
  checkPlant,
  crossedOnfCardThreshold,
  getChapterCardRegion,
  getOpenRegions,
  getRegionFeature,
  markCardsSeen,
  mergeCollectedIds,
  pickChapterCard,
  PlantRefusal,
} from '../constants/herbier';
import { ALL_TREE_CARDS } from '../utils/onfCards';
import { EMPTY_PODIUM, PodiumStats, recordPodium } from '../constants/trophies';
import { computeOwnedMusic, isFreeMusic, mergeUnlockedMusic } from '../constants/musicUnlocks';
import { MUSIC_TRACK_IDS } from '../constants/music';
import { isFeatureUnlocked } from '../constants/progression';
import {
  BONUS_USES_PER_DAY,
  FRIEND_TOKENS_PER_DAY,
  createFreshDailyLimits,
  getOnfRemaining,
  isLimitsOfDay,
  mergeDailyLimits,
  sanitizeDailyLimits,
  todayLocalISO,
} from '../constants/dailyLimits';
import {
  AdPlacement,
  AdViews,
  addAdView,
  getAdViews,
  isPlacementAvailableToPremium,
} from '../constants/adRewards';
import {
  clearNewBadges,
  getCeremoniesToEnqueue,
  getNewBadgesForCeremonies,
  mergeCeremonyIds,
} from '../constants/ceremonies';

/** Type d'effet visuel en jeu (particules en arrière-plan) */
export type VisualEffect = 'leaves' | 'butterflies' | 'birds' | 'none';
import {
  BADGE_MAP,
  BADGE_SEED_REWARDS,
} from '../constants/badges';
// Les trophées n'ont plus d'« objectif actif » (Progression v2, C8) : plus de pistes, de `trackGoals`,
// de `activeBadgeGoals` ni de `goalCounters`. Tout trophée dont la condition est remplie est décerné.

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
  // ── Compteurs ONF et daily (refonte badges) ──────────────────
  onfPerfectCount: number;    // grilles ONF validées sans erreur
  onfSpeedCount: number;      // grilles ONF résolues en < 120s
  dailyPerfectCount: number;  // défis daily gagnés sans erreur
  dailySpeedCount: number;    // défis daily gagnés en < 180s
  // ── Statistiques du Lot D (tous cumulatifs, fusionnés par maximum au restoreFromCloud) ──
  friendLosses: number;           // défis entre amis perdus (résultat connu : l'adversaire a joué)
  friendBestWinStreak: number;    // record de victoires de Duel d'affilée
  dailyPlayedPousse: number;      // parties du Journalier jouées dans la ligue Pousse
  dailyWonPousse: number;
  dailyPlayedGrandChene: number;  // … dans la ligue Grand Chêne
  dailyWonGrandChene: number;
  bestDailyTimeMsPousse: number;      // meilleur temps du Journalier par ligue (0 = aucun)
  bestDailyTimeMsGrandChene: number;
  bestOnfTimeMs: number;          // meilleur temps d'une grille du Forestier (0 = aucun)
  seedsEarned: number;            // graines gagnées au total (jamais décrémenté : dépenser n'en retire pas)
  seedsSpent: number;             // graines dépensées (plantation dans l'Herbier)
  adsWatched: number;             // pubs récompensées regardées (cumul, toutes les emplacements)
  daysPlayed: number;             // jours distincts où le joueur s'est connecté
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

  // Niveau courant du joueur.
  // PROGRESSION_V2 : dérivé de challengeStars (computeLevelProgress). Sinon : completedChallenges.length / 10.
  currentLevel: number;

  // ── Progression v2 (docs/progression-v2.md, section D) ──────────────────────
  /** Version du modèle de progression. < 2 → remise à zéro unique (C9). */
  progressionVersion: number;
  /** Meilleure note (1 à 3) par défi solo. Ne baisse jamais, ne se dépense jamais. */
  challengeStars: Record<string, StarRating>;
  /** Niveaux consécutifs validés depuis le niveau 1 (0 à 21). Dérivé de challengeStars. */
  levelsCompleted: number;
  /** Cérémonies à rejouer (Lot 4). */
  pendingCeremonies: string[];
  /** Cérémonies déjà vues (Lot 4). */
  seenCeremonies: string[];
  /** Chapitres (1 à 7) dont la récompense de fin de chapitre a déjà été versée. Jamais versée deux fois. */
  rewardedChapters: number[];
  /** Chapitres dont la carte d'Herbier de fin de chapitre a déjà été offerte (anti-doublon, Lot 7). */
  chapterCardsGranted: number[];
  /** Fonctionnalités débloquées jamais ouvertes (pastille « Nouveau », Lot 4). */
  newFeatureBadges: string[];
  /** Titres musicaux débloqués (source de vérité à partir du Lot 8). */
  unlockedMusicIds: string[];
  // Compteurs de trophées (Lot 8)
  starStreak: number;
  quickFirstWins: number;
  improvedStarChallengeIds: string[];
  loyaltyStreak: number;
  /** Meilleure série de jours joués d'affilée : record qui ne baisse jamais (Habitué, Lot 8). */
  loyaltyBest: number;
  /** Meilleure série de victoires ⭐⭐+ d'affilée : record qui ne baisse jamais (Œil de lynx, Lot 8). */
  bestStarStreak: number;
  /** Podium du Journalier (inclusif), enregistré au moment de la partie (Lot 8). */
  dailyPodium: PodiumStats;

  // ── Badges ──────────────────────────────────────────────────────────────────
  earnedBadges: string[];                   // IDs des badges obtenus
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
  onfSolvedCount: number;              // nb de grilles 4×4 résolues
  lastOnfCompoKey: string | null;      // clé de la dernière composition jouée (anti-répétition)
  completedOnfChallengeIds: string[]; // IDs des défis ONF terminés (pour ne pas reproposer)
  hasSeenOnfBriefing: boolean;        // briefing ONF affiché au moins une fois
  onfDailyCount: number;              // grilles ONF jouées aujourd'hui (reset quotidien, free = max 3)
  lastOnfDailyDate: string;           // "YYYY-MM-DD" du dernier reset onfDailyCount

  // ── Herbier de la Forêt — cartes à collectionner ─────────────────────────
  /** IDs (1-indexés) des cartes arbre débloquées. 1 carte tous les ONF_CARD_UNLOCK_EVERY défis. */
  collectedTreeCardIds: number[];
  /**
   * Cartes de l'Herbier déjà vues dans la collection. Le badge rouge de « Ma collection » compte les cartes
   * possédées qui n'y figurent pas (`countUnseenCards`). Une carte vue ne redevient jamais « nouvelle ».
   */
  seenTreeCardIds: number[];

  // ── Défis amis : amis uniques défiés (pour badge social_poignee / social_cirque) ──
  /** UIDs des amis à qui le joueur a envoyé au moins un défi. Jamais de doublons. */
  challengedFriendIds: string[];
  /** Défis entre amis terminés déjà comptés dans les statistiques (Lot D). */
  countedDuelIds: string[];
  /** Série de victoires de Duel en cours. */
  duelWinStreak: number;

  // ── Bonus journaliers (chantier 4) ───────────────────────────────────────────
  dailyBonusUses: Record<BonusId, number>; // utilisations restantes aujourd'hui
  lastBonusResetDate: string | null;        // "YYYY-MM-DD" du dernier reset

  // ── Publicité : recharge des bonus (1 fois/jour, mode free uniquement) ───────
  /** Pubs récompensées regardées aujourd'hui, par emplacement (Lot B) ; plafonds dans `adRewards.ts`. */
  adViews: AdViews;

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
    errorCount: number,
    elementChangeCount?: number,
    bonusUsedCount?: number
  ) => void;
  /**
   * Enregistre les étoiles d'une victoire SOLO (Progression v2, C1).
   * À appeler AVANT markChallengeCompleted (qui ajoute le défi à completedChallenges :
   * isFirstWin se lit sur l'état d'avant). Garde la MEILLEURE note, met à jour
   * levelsCompleted / currentLevel et les compteurs de trophées. Ne touche pas aux graines.
   */
  recordSoloStars: (input: {
    challengeId: string;
    failCount: number;
    bonusUsedCount: number;
    elementChangeCount: number;
    elapsedMs: number;
    estimatedDurationMs: number;
  }) => StarResult;
  /**
   * Remise à zéro unique du profil de progression (C9) : valeurs par défaut, seeds = 3,
   * isPremium = false (voir profileDefaults.ts), progressionVersion = 2.
   * Conserve identité, langue et préférences audio. Idempotente.
   */
  resetProgression: () => void;
  /**
   * Verse les graines de fin de chapitre pour tous les chapitres terminés et pas encore récompensés
   * (Progression v2, C3). IDEMPOTENTE : un chapitre n'est jamais versé deux fois, même si on la rappelle,
   * si on resynchronise, ou si plusieurs chapitres se terminent d'un coup. Ne fait rien si le drapeau
   * PROGRESSION_V2 est désactivé. Retourne les chapitres versés (vide si rien) et le total de graines.
   */
  grantChapterRewards: () => { chapters: Chapter[]; seeds: number };
  /**
   * Met en file les cérémonies de fin de chapitre (et les pastilles « Nouveau » de leurs modes) pour
   * tous les chapitres terminés dont la cérémonie n'est ni déjà en attente ni déjà vue (Lot 4, C7).
   * IDEMPOTENTE. Ne fait rien si PROGRESSION_V2 est désactivé. Retourne les cérémonies ajoutées.
   */
  enqueueCeremonies: () => string[];
  /**
   * Mémorise les titres de musique débloqués (fin de chapitre + trophées) dans `unlockedMusicIds` : un titre
   * débloqué ne se perd jamais, même si la progression est resynchronisée. IDEMPOTENTE ; retourne les titres
   * NOUVEAUX (pour annoncer le déblocage). Les 2 titres gratuits ne sont pas mémorisés (toujours possédés).
   */
  syncUnlockedMusic: () => string[];
  /**
   * Marque une cérémonie comme VUE : elle sort de la file d'attente et ne sera plus jamais rejouée.
   * À appeler dès que le joueur a atteint la fin (ou quitté) la cérémonie.
   */
  markCeremonySeen: (ceremonyId: string) => void;
  /** Efface la pastille « Nouveau » d'une tuile (`duel` | `onf` | `daily`) : 1re partie jouée dans ce mode. */
  clearNewFeatureBadge: (tile: 'duel' | 'onf' | 'daily') => void;
  recordChallengeFailure: (challengeId: string) => void;
  setLastPlayed: (challengeId: string) => void;
  unlockPremium: () => void;
  logout: () => void;

  // ── Actions badges ───────────────────────────────────────────────────────────
  awardBadge: (badgeId: string) => void;
  /** Attribue plusieurs badges en UN SEUL set() — évite la cascade de re-renders */
  awardBadges: (badgeIds: string[]) => void;
  setBadgeShowcase: (badges: [string?, string?, string?]) => void;

  // ── Actions bonus journaliers (chantier 4) ───────────────────────────────────
  spendBonus: (bonusId: BonusId) => boolean;
  /**
   * Crédite la récompense d'une pub REGARDÉE jusqu'au bout (Lot B) : recharge un bonus, +1 grille Forestier, +1 jeton
   * de Duel, ou compte la visite de la Forêt commune / des graines ×2. Refuse (false) si le joueur est premium (sauf
   * Forêt commune) ou si le plafond quotidien de l'emplacement est atteint. Un seul `set()`.
   */
  claimAdReward: (placement: AdPlacement) => boolean;
  /** Passe les limites quotidiennes au jour courant (remise à neuf si périmées). Retourne true si un reset a eu lieu. */
  rolloverDailyLimits: () => boolean;

  // ── Actions social ───────────────────────────────────────────────────────────
  /**
   * Compte les défis entre amis TERMINÉS pas encore comptés (liste du plus ancien au plus récent) : victoires, défaites,
   * série. Idempotent (`countedDuelIds`). Retourne les victoires et défaites NOUVELLES.
   */
  recordDuelResults: (uid: string, duels: readonly CompletedDuel[]) => { wins: number; losses: number };
  /** Enregistre un défi envoyé à un ami (uniquement si c'est un nouvel ami).
   *  Met à jour challengedFriendIds et totalFriendsInvited. */
  recordFriendChallenged: (friendUid: string) => void;
  /**
   * Enregistre le classement d'une victoire au Journalier dans le podium (inclusif : un n° 1 compte aussi
   * comme top 3 et top 10 %). `rank` / `total` : rang et participants DANS LA LIGUE du joueur. À appeler une
   * seule fois par victoire (le Journalier n'autorise qu'une partie par jour).
   */
  recordDailyPodium: (rank: number, total: number) => void;

  // ── Actions tutoriels bonus ──────────────────────────────────────────────────
  dismissBonusTutorial: (bonusId: BonusId) => void;
  resetBonusTutorials: () => void;

  // ── Actions effet visuel ───────────────────────────────────────────────────
  setVisualEffect: (effect: VisualEffect) => void;

  // ── Action quotidienne ───────────────────────────────────────────────────────
  checkDailyLogin: () => boolean; // Retourne true si c'est la première connexion du jour

  // ── Actions défi journalier ─────────────────────────────────────────────────
  submitDailyResult: (date: string, success: boolean, timeMs?: number, league?: DailyLeague) => void;
  resetDailyStatus: () => void;

  // ── Actions anti-triche ───────────────────────────────────────────────────
  markChallengeStarted: (challengeId: string) => void;
  markChallengeAbandoned: (challengeId: string) => void;

  // ── Actions notifications amis ───────────────────────────────────────────
  setFriendNotifBadgeEnabled: (enabled: boolean) => void;

  // ── Actions Herbier de la Forêt ──────────────────────────────────────────
  /** Ajoute une carte à la collection (idempotent — pas de doublon). */
  collectTreeCard: (cardId: number) => void;
  /**
   * Le joueur vient d'afficher sa collection : toutes les cartes possédées sont marquées « vues » et le badge
   * rouge disparaît. Sans effet (même référence, aucun rendu) s'il n'y a rien de nouveau.
   */
  markTreeCardsSeen: () => void;
  /**
   * Plante une carte de l'Herbier en dépensant des graines (Progression v2, C6). Coût :
   * `30 + 5 × floor(nbCartesPossédées / 10)`. Refuse (sans dépenser) si la carte est inconnue, déjà
   * possédée, d'une région fermée, ou si les graines manquent. Retourne le résultat et le coût.
   */
  plantTreeCard: (cardId: number) => { ok: true; cost: number } | { ok: false; reason: PlantRefusal; cost: number };
  /**
   * Offre la carte gratuite de FIN DE CHAPITRE pour chaque chapitre récompensé qui n'a pas encore
   * donné sa carte (la suivante de la région, ou une légendaire au chapitre 7). IDEMPOTENTE : une
   * carte par chapitre au plus, mémorisée dans `chapterCardsGranted`. Sans effet si PROGRESSION_V2
   * est désactivé. Retourne les cartes offertes.
   */
  grantChapterCards: () => number[];
  /**
   * Offre la carte gratuite du Forestier si la grille qui vient d'être résolue franchit un palier de
   * `ONF_CARD_UNLOCK_EVERY`. Retourne la carte offerte, ou null. À appeler avec les compteurs d'AVANT
   * et d'APRÈS `recordOnfVictory`.
   */
  grantOnfCard: (countBefore: number, countAfter: number) => number | null;

  // ── Actions mode ONF ─────────────────────────────────────────────────────
  incrementOnfSolved: () => void;
  setLastOnfCompoKey: (key: string) => void;
  /** Marque un défi ONF comme terminé (ajoute son ID, incrémente le compteur). */
  markOnfChallengeCompleted: (challengeId: string) => void;
  /** Enregistre une victoire ONF avec tous les compteurs badges. */
  recordOnfVictory: (challengeId: string, failCount: number, elapsedMs: number) => void;
  /** Marque le briefing ONF comme vu (ne s'affiche plus après). */
  markOnfBriefingSeen: () => void;
  /** Incrémente le compteur de grilles ONF jouées aujourd'hui (limite free = 3). */
  incrementOnfDaily: () => void;

  // ── Action victoire daily (refonte badges) ─────────────────
  /** Enregistre les compteurs de victoire daily (elapsedMs pour dailySpeedCount). */
  recordDailyVictory: (elapsedMs: number) => void;

}

/** Étoiles d'une partie (wrapper local pour garder l'import de computeStars hors du store). */
function computeStarsFromInput(i: { failCount: number; bonusUsedCount: number; elementChangeCount: number }): StarRating {
  return computeStars(i);
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

// ── Store ─────────────────────────────────────────────────────────────────────

export const usePlayerStore = create<PlayerState>((set, get) => ({
  authReady: false,
  isAuthenticated: false,

  userId: null,
  username: 'Joueur',
  seeds: 0,
  completedChallenges: [],
  isPremium: false,
  lastPlayedChallengeId: null,
  friendChallengeTokens: 3,

  language: getSystemLocale(),

  currentLevel: computePlayerLevel(0),

  progressionVersion: CURRENT_PROGRESSION_VERSION,
  challengeStars: {},
  levelsCompleted: 0,
  pendingCeremonies: [],
  seenCeremonies: [],
  rewardedChapters: [],
  chapterCardsGranted: [],
  newFeatureBadges: [],
  unlockedMusicIds: [],
  starStreak: 0,
  quickFirstWins: 0,
  improvedStarChallengeIds: [],
  loyaltyStreak: 0,
  loyaltyBest: 0,
  bestStarStreak: 0,
  dailyPodium: { ...EMPTY_PODIUM },

  stats: createDefaultStats(),

  earnedBadges: [],
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
  completedOnfChallengeIds: [],
  hasSeenOnfBriefing: false,
  onfDailyCount: 0,
  lastOnfDailyDate: '',
  collectedTreeCardIds: [],
  seenTreeCardIds: [],

  challengedFriendIds: [],
  countedDuelIds: [],
  duelWinStreak: 0,

  dailyBonusUses: { reveal_cell: 3, instinct: 3 },
  lastBonusResetDate: null,

  adViews: {},

  // ── setAuthState ──────────────────────────────────────────
  setAuthState: (ready, authenticated) => set({ authReady: ready, isAuthenticated: authenticated }),

  // ── setUser ───────────────────────────────────────────────
  setUser: (userId, username) => set({ userId, username }),

  // ── setLanguage ───────────────────────────────────────────
  setLanguage: (lang) => set({ language: lang }),

  // ── Jetons ami ────────────────────────────────────────────
  // Remboursement : jamais au-delà du plafond quotidien (FRIEND_TOKENS_PER_DAY). Un premium ou un compte démo
  // ne paie pas de jeton : rien à rembourser, le compteur ne bouge pas.
  addFriendChallengeToken: () => set(state => ({
    friendChallengeTokens: Math.min(FRIEND_TOKENS_PER_DAY, state.friendChallengeTokens + 1),
  })),

  spendFriendChallengeToken: () => {
    get().rolloverDailyLimits();
    const { isPremium, friendChallengeTokens } = get();
    if (isPremium) return true; // Illimité en premium
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

    // Progression v2 : les étoiles ne baissent jamais → max par défi entre local et cloud.
    const mergedStars = mergeChallengeStars(get().challengeStars, profile.challengeStars);
    const mergedProgress = computeLevelProgress(mergedStars);

    // Limites quotidiennes (Lot A) : le plus restrictif entre le local et le cloud, pour aujourd'hui seulement.
    // Se reconnecter ou changer d'appareil ne rend donc jamais des parties du jour.
    const mergedLimits = mergeDailyLimits(
      sanitizeDailyLimits(get()),
      sanitizeDailyLimits(profile.dailyLimits),
      todayLocalISO(),
    );

    set({
      userId: profile.userId,
      username: profile.username,
      seeds: profile.seeds,
      completedChallenges: profile.completedChallenges,
      // Premium : un achat n'est jamais perdu. Si le cloud n'a pas (encore) l'achat fait localement, on le
      // garde ; l'appelant (_layout.tsx) le réécrit dans Firestore.
      isPremium: profile.isPremium || get().isPremium,
      ...mergedLimits,
      dailyBonusUses: mergedLimits.dailyBonusUses as Record<BonusId, number>,
      progressionVersion: profile.progressionVersion ?? CURRENT_PROGRESSION_VERSION,
      challengeStars: mergedStars,
      levelsCompleted: mergedProgress.levelsCompleted,
      ...(() => {
        // Une cérémonie vue (ici OU sur un autre appareil) ne doit jamais revenir en attente :
        // on fusionne les « vues », puis on retire de la file tout ce qui a été vu.
        const seen = mergeCeremonyIds(get().seenCeremonies, profile.seenCeremonies);
        const pending = mergeCeremonyIds(get().pendingCeremonies, profile.pendingCeremonies)
          .filter(id => !seen.includes(id));
        return { pendingCeremonies: pending, seenCeremonies: seen };
      })(),
      rewardedChapters: mergeRewardedChapters(get().rewardedChapters, profile.rewardedChapters),
      chapterCardsGranted: mergeRewardedChapters(get().chapterCardsGranted, profile.chapterCardsGranted),
      newFeatureBadges: Array.from(new Set([...(get().newFeatureBadges ?? []), ...(profile.newFeatureBadges ?? [])])),
      unlockedMusicIds: mergeUnlockedMusic(get().unlockedMusicIds, profile.unlockedMusicIds),
      starStreak: Math.max(get().starStreak ?? 0, profile.starStreak ?? 0),
      quickFirstWins: Math.max(get().quickFirstWins ?? 0, profile.quickFirstWins ?? 0),
      improvedStarChallengeIds: Array.from(new Set([...(get().improvedStarChallengeIds ?? []), ...(profile.improvedStarChallengeIds ?? [])])),
      loyaltyStreak: Math.max(get().loyaltyStreak ?? 0, profile.loyaltyStreak ?? 0),
      loyaltyBest: Math.max(get().loyaltyBest ?? 0, profile.loyaltyBest ?? 0, profile.loyaltyStreak ?? 0),
      bestStarStreak: Math.max(get().bestStarStreak ?? 0, profile.bestStarStreak ?? 0, profile.starStreak ?? 0),
      dailyPodium: {
        top10Percent: Math.max(get().dailyPodium?.top10Percent ?? 0, profile.dailyPodium?.top10Percent ?? 0),
        top3: Math.max(get().dailyPodium?.top3 ?? 0, profile.dailyPodium?.top3 ?? 0),
        first: Math.max(get().dailyPodium?.first ?? 0, profile.dailyPodium?.first ?? 0),
      },
      currentLevel: resolvePlayerLevel(PROGRESSION_V2, mergedStars, profile.completedChallenges?.length ?? 0),
      // Statistiques (Lot D) : fusion `mergeStats` — les compteurs cumulatifs ne baissent JAMAIS (max local/cloud),
      // `bestTimes` garde le meilleur temps par défi, les dictionnaires fusionnent clé par clé. Avant : dailyPlayed,
      // dailyWon, friendPlayed, failCount… étaient ÉCRASÉS par le cloud (0 si le Journalier ou le Duel n'y avaient jamais
      // écrit leurs stats), ce qui faisait régresser le trophée Rendez-vous à chaque reconnexion.
      // Profil cloud vierge (nouveau compte) : pas de contamination par les stats d'une session précédente.
      stats: isNewCloudProfile
        ? mergeStats(createDefaultStats(), profile.stats as StatsLike)
        : mergeStats(get().stats, profile.stats as StatsLike),
      // Duel : union des défis déjà comptés (un défi compté sur un appareil ne se recompte pas sur l'autre) ; la série
      // en cours prend la plus grande des deux (elle ne dépasse jamais le record fusionné ci-dessus).
      countedDuelIds: isNewCloudProfile
        ? Array.from(new Set(profile.countedDuelIds ?? []))
        : Array.from(new Set([...get().countedDuelIds, ...(profile.countedDuelIds ?? [])])),
      duelWinStreak: isNewCloudProfile
        ? (profile.duelWinStreak ?? 0)
        : Math.max(get().duelWinStreak, profile.duelWinStreak ?? 0),
      earnedBadges:    mergedEarned,
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
      completedOnfChallengeIds: (profile as any).completedOnfChallengeIds ?? [],
      // Herbier : union sans doublon, triée — jamais perdre les cartes offline
      collectedTreeCardIds: Array.from(new Set([
        ...(get().collectedTreeCardIds ?? []),
        ...((profile as any).collectedTreeCardIds ?? []),
      ])).sort((a, b) => a - b),
      // Cartes déjà vues : union (une carte vue ici OU sur un autre appareil ne redevient jamais « nouvelle »)
      seenTreeCardIds: mergeCollectedIds(get().seenTreeCardIds, (profile as any).seenTreeCardIds),
    });

  },

  // ── Graines ───────────────────────────────────────────────
  addSeeds: (amount) => set(state => ({
    seeds: state.seeds + amount,
    // Lot D : cumul des graines gagnées (un montant négatif ou invalide ne compte pas comme un gain)
    stats: amount > 0 ? { ...state.stats, seedsEarned: state.stats.seedsEarned + Math.floor(amount) } : state.stats,
  })),

  spendSeeds: (amount) => {
    const { seeds } = get();
    if (seeds < amount) return false;
    set(state => ({
      seeds: state.seeds - amount,
      stats: amount > 0 ? { ...state.stats, seedsSpent: state.stats.seedsSpent + Math.floor(amount) } : state.stats,
    }));
    return true;
  },

  // ── recordSoloStars (Progression v2, C1) ────────────────────
  recordSoloStars: (input) => {
    const state = get();
    // Étoiles de cette partie (aucune validation ratée / aucun bonus / aucun jeton déplacé)
    const stars = computeStarsFromInput(input);
    const result = applyStarResult({
      challengeStars: state.challengeStars,
      challengeId: input.challengeId,
      stars,
      alreadyCompleted: state.completedChallenges.includes(input.challengeId),
      elapsedMs: input.elapsedMs,
      estimatedDurationMs: input.estimatedDurationMs,
      starStreak: state.starStreak,
      quickFirstWins: state.quickFirstWins,
      improvedStarChallengeIds: state.improvedStarChallengeIds,
    });
    set({
      challengeStars: result.challengeStars,
      levelsCompleted: result.progressAfter.levelsCompleted,
      starStreak: result.starStreak,
      // Œil de lynx : on décerne sur le RECORD de la série (la série en cours retombe à 0 sur une victoire à ⭐)
      bestStarStreak: Math.max(state.bestStarStreak, result.starStreak),
      quickFirstWins: result.quickFirstWins,
      improvedStarChallengeIds: result.improvedStarChallengeIds,
      // Le niveau suit les étoiles seulement si PROGRESSION_V2 ; sinon markChallengeCompleted le recalcule.
      ...(PROGRESSION_V2 ? { currentLevel: result.progressAfter.currentLevel } : {}),
    });
    return result;
  },

  // ── grantChapterRewards (Progression v2, C3) ────────────────
  grantChapterRewards: () => {
    if (!PROGRESSION_V2) return { chapters: [], seeds: 0 };
    const state = get();
    const chapters = getChaptersToReward(state.levelsCompleted, state.rewardedChapters);
    if (chapters.length === 0) return { chapters: [], seeds: 0 };
    const seeds = sumChapterSeeds(chapters);
    // Un seul set() : graines ET marquage « récompensé » ensemble. Si l'appel est rejoué juste après,
    // getChaptersToReward ne renvoie plus rien : aucun double versement possible.
    set({
      seeds: state.seeds + seeds,
      stats: seeds > 0 ? { ...state.stats, seedsEarned: state.stats.seedsEarned + seeds } : state.stats,
      rewardedChapters: mergeRewardedChapters(state.rewardedChapters, chapters.map(c => c.id)),
    });
    // Le titre de musique de chaque chapitre terminé est mémorisé (Lot 8, D11) : il ne se perd jamais.
    get().syncUnlockedMusic();
    return { chapters, seeds };
  },

  // ── enqueueCeremonies (Progression v2, C7) ──────────────────
  enqueueCeremonies: () => {
    if (!PROGRESSION_V2) return [];
    const state = get();
    const toAdd = getCeremoniesToEnqueue(state.levelsCompleted, state.pendingCeremonies, state.seenCeremonies);
    if (toAdd.length === 0) return [];
    // Un seul set() : file ET pastilles ensemble (cohérent, un seul rendu).
    set({
      pendingCeremonies: mergeCeremonyIds(state.pendingCeremonies, toAdd),
      newFeatureBadges: [
        ...state.newFeatureBadges,
        ...getNewBadgesForCeremonies(toAdd, state.newFeatureBadges),
      ],
    });
    return toAdd;
  },

  syncUnlockedMusic: () => {
    const state = get();
    // Seuls les titres DÉBLOQUÉS par la progression sont mémorisés : les gratuits sont toujours possédés.
    const owned = computeOwnedMusic(state.levelsCompleted, state.earnedBadges, state.unlockedMusicIds, MUSIC_TRACK_IDS)
      .filter(id => !isFreeMusic(id));
    // Ordre du catalogue (déterministe), sans doublon ; les titres déjà mémorisés sont conservés.
    const keep = new Set([...state.unlockedMusicIds, ...owned]);
    const next = MUSIC_TRACK_IDS.filter(id => keep.has(id) && !isFreeMusic(id));
    const fresh = next.filter(id => !state.unlockedMusicIds.includes(id));
    if (fresh.length === 0) return [];
    set({ unlockedMusicIds: next });
    return fresh;
  },

  markCeremonySeen: (ceremonyId) => {
    const state = get();
    set({
      pendingCeremonies: state.pendingCeremonies.filter(id => id !== ceremonyId),
      seenCeremonies: state.seenCeremonies.includes(ceremonyId)
        ? state.seenCeremonies
        : mergeCeremonyIds(state.seenCeremonies, [ceremonyId]),
    });
  },

  clearNewFeatureBadge: (tile) => {
    const state = get();
    const next = clearNewBadges(tile, state.newFeatureBadges);
    if (next.length === state.newFeatureBadges.length) return; // rien à effacer : aucun rendu
    set({ newFeatureBadges: next });
  },

  // ── resetProgression (C9) ───────────────────────────────────
  // Remise à zéro unique. Le chargement AsyncStorage et la restauration cloud sont
  // pilotés par l'appelant (_layout.tsx / useStorage) ; ici : état local seulement.
  resetProgression: () => {
    const d = createDefaultProgressionFields();
    set({
      progressionVersion: d.progressionVersion,
      seeds: d.seeds,
      isPremium: d.isPremium,
      friendChallengeTokens: d.friendChallengeTokens,
      completedChallenges: d.completedChallenges,
      challengeStars: d.challengeStars,
      levelsCompleted: d.levelsCompleted,
      currentLevel: d.currentLevel,
      lastPlayedChallengeId: d.lastPlayedChallengeId,
      challengeStartedAt: d.challengeStartedAt,
      pendingCeremonies: d.pendingCeremonies,
      seenCeremonies: d.seenCeremonies,
      rewardedChapters: d.rewardedChapters,
      chapterCardsGranted: d.chapterCardsGranted,
      newFeatureBadges: d.newFeatureBadges,
      unlockedMusicIds: d.unlockedMusicIds,
      starStreak: d.starStreak,
      quickFirstWins: d.quickFirstWins,
      improvedStarChallengeIds: d.improvedStarChallengeIds,
      loyaltyStreak: d.loyaltyStreak,
      loyaltyBest: d.loyaltyBest,
      bestStarStreak: d.bestStarStreak,
      dailyPodium: { ...d.dailyPodium },
      earnedBadges: d.earnedBadges,
      badgeShowcase: [undefined, undefined, undefined],
      stats: createDefaultStats(),
      dailyStreak: d.dailyStreak,
      lastPlayedDate: d.lastPlayedDate,
      dailyChallengeStreak: d.dailyChallengeStreak,
      longestDailyChallengeStreak: d.longestDailyChallengeStreak,
      lastDailyChallengeDate: d.lastDailyChallengeDate,
      dailyChallengeStatus: d.dailyChallengeStatus,
      dailyChallengeTimeMs: d.dailyChallengeTimeMs,
      onfSolvedCount: d.onfSolvedCount,
      completedOnfChallengeIds: d.completedOnfChallengeIds,
      hasSeenOnfBriefing: d.hasSeenOnfBriefing,
      onfDailyCount: d.onfDailyCount,
      lastOnfDailyDate: d.lastOnfDailyDate,
      lastOnfCompoKey: d.lastOnfCompoKey,
      collectedTreeCardIds: d.collectedTreeCardIds,
      seenTreeCardIds: d.seenTreeCardIds,
      challengedFriendIds: d.challengedFriendIds,
      countedDuelIds: d.countedDuelIds,
      duelWinStreak: d.duelWinStreak,
      dailyBonusUses: { ...d.dailyBonusUses },
      lastBonusResetDate: d.lastBonusResetDate,
      bonusTutorialDismissed: [],
      adViews: { ...d.adViews },
    });
  },
  // ── markChallengeCompleted ─────────────────────────────────
  // failCountForThisGame = nb de fois où le joueur a tapé "Valider" et échoué
  // pendant CETTE partie (avant la victoire finale).
  // noErrorStreak s'incrémente seulement si failCountForThisGame === 0.
  markChallengeCompleted: (challengeId, timeMs, errorCount, elementChangeCount = 0, bonusUsedCount = 0) => {
    set(state => {
      const alreadyCompleted = state.completedChallenges.includes(challengeId);
      const prevBest = state.stats.bestTimes[challengeId];
      const newBest  = prevBest !== undefined ? Math.min(prevBest, timeMs) : timeMs;
      const improved = prevBest !== undefined && timeMs < prevBest;

      const newCompleted = alreadyCompleted
        ? state.completedChallenges
        : [...state.completedChallenges, challengeId];

      // Les jetons défi ami se rechargent quotidiennement (reset dans checkDailyLogin)

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

      return {
        completedChallenges: newCompleted,
        // PROGRESSION_V2 : le niveau vient des étoiles (recordSoloStars, appelé avant) ; sinon ancien calcul.
        currentLevel: PROGRESSION_V2
          ? computeLevelProgress(state.challengeStars).currentLevel
          : computePlayerLevel(newCompleted.length),
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
  unlockPremium: () => {
    const wasPremium = usePlayerStore.getState().isPremium;
    set({ isPremium: true });
    usePlayerStore.getState().awardBadges(['ami_de_la_foret']);
    // Modale de félicitations (montée à la racine) : une seule fois, au passage à premium
    if (!wasPremium) {
      import('./premiumCelebrationStore').then(({ usePremiumCelebrationStore }) => {
        // Léger délai : la carte d'achat (Modal native) se ferme au même moment
        setTimeout(() => usePremiumCelebrationStore.getState().show(), 350);
      });
    }
    // Plante 1 arbre immédiatement dans la cagnotte partagée (1 € = 1 arbre)
    import('../services/foretCommuneService').then(({ addTreeDirect }) => {
      addTreeDirect().catch(() => {});
    });
  },

  // ── logout ────────────────────────────────────────────────
  logout: () => set({
    isAuthenticated: false,
    // authReady reste true : Firebase a déjà répondu, on sait qu'on est déconnecté
    userId: null,
    username: 'Joueur',
    seeds: 0,
    completedChallenges: [],
    isPremium: false,
    lastPlayedChallengeId: null,
    currentLevel: 1,
    progressionVersion: CURRENT_PROGRESSION_VERSION,
    challengeStars: {},
    levelsCompleted: 0,
    pendingCeremonies: [],
    seenCeremonies: [],
    rewardedChapters: [],
    chapterCardsGranted: [],
    newFeatureBadges: [],
    unlockedMusicIds: [],
    starStreak: 0,
    quickFirstWins: 0,
    improvedStarChallengeIds: [],
    loyaltyStreak: 0,
    loyaltyBest: 0,
    bestStarStreak: 0,
    dailyPodium: { ...EMPTY_PODIUM },
    stats: createDefaultStats(),
    earnedBadges: [],
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
    completedOnfChallengeIds: [],
    onfDailyCount: 0,
    lastOnfDailyDate: '',
    collectedTreeCardIds: [],
    seenTreeCardIds: [],
    // Duel : les défis comptés appartiennent à UN compte (le suivant ne doit pas hériter de la liste)
    challengedFriendIds: [],
    countedDuelIds: [],
    duelWinStreak: 0,
    // Limites quotidiennes : la sauvegarde locale appartient à UN compte ; à la déconnexion elle est remise à neuf
    // (le compte suivant ne doit pas hériter des parties du précédent). La vraie valeur est dans Firestore
    // (`dailyLimits`) et revient à la connexion via `mergeDailyLimits` : se déconnecter ne rend rien.
    dailyBonusUses: { reveal_cell: 3, instinct: 3 },
    lastBonusResetDate: null,
    friendChallengeTokens: FRIEND_TOKENS_PER_DAY,
    adViews: {},
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
    set(state => {
      // Filtrer les badges déjà obtenus (idempotence)
      const toAdd = badgeIds.filter(id => !state.earnedBadges.includes(id));

      const newEarned = toAdd.length > 0
        ? [...state.earnedBadges, ...toAdd]
        : state.earnedBadges;
      const newEarnedSet = new Set(newEarned);

      // Rien à faire : no-op pour éviter un re-render inutile
      if (toAdd.length === 0) return state;

      // Cumuler les graines des nouveaux badges seulement
      const totalSeeds = toAdd.reduce((acc, id) => {
        const def = BADGE_MAP[id];
        return acc + (def ? BADGE_SEED_REWARDS[def.rarity] : 0);
      }, 0);

      return {
        earnedBadges:    newEarned,
        seeds:           state.seeds + totalSeeds,
        stats:           totalSeeds > 0 ? { ...state.stats, seedsEarned: state.stats.seedsEarned + totalSeeds } : state.stats,
      };
    });
  },

  // ── setBadgeShowcase ──────────────────────────────────────
  setBadgeShowcase: (badges) => set({ badgeShowcase: badges }),

  // ── Social ────────────────────────────────────────────────
  // Duel (Lot D) : le résultat est connu seulement quand l'adversaire a joué. `recordDuelResults` compte les défis
  // TERMINÉS pas encore comptés (liste lue dans Firestore, du plus ancien au plus récent) : victoires, défaites, série.
  // Idempotent : un défi déjà dans `countedDuelIds` est ignoré. Remplace `recordFriendWin` (le challenger était compté
  // gagnant dès l'envoi, avant tout résultat).
  recordDuelResults: (uid, duels) => {
    const s = get();
    const tally = tallyNewDuels(uid, duels, s.countedDuelIds, { winStreak: s.duelWinStreak, bestWinStreak: s.stats.friendBestWinStreak });
    if (tally.played === 0) return { wins: 0, losses: 0 };
    set({
      countedDuelIds: tally.countedIds,
      duelWinStreak: tally.winStreak,
      stats: {
        ...s.stats,
        friendWins: s.stats.friendWins + tally.wins,
        friendLosses: s.stats.friendLosses + tally.losses,
        friendPlayed: s.stats.friendPlayed + tally.played,
        friendBestWinStreak: tally.bestWinStreak,
      },
    });
    return { wins: tally.wins, losses: tally.losses };
  },

  // Graines (Lot D) : `seedsEarned` ne baisse jamais (dépenser dans l'Herbier n'en retire pas) ; `seedsSpent` cumule les
  // dépenses. Les deux sont tenus à la source (addSeeds, grantChapterRewards, awardBadges, spendSeeds, plantTreeCard).

  recordFriendChallenged: (friendUid) => set(state => {
    // Ignorer si cet ami a déjà été défié (on ne compte que les nouveaux)
    if (state.challengedFriendIds.includes(friendUid)) return state;
    const newList = [...state.challengedFriendIds, friendUid];
    return {
      challengedFriendIds: newList,
      stats: { ...state.stats, totalFriendsInvited: newList.length },
    };
  }),

  recordDailyPodium: (rank, total) => set(state => {
    const next = recordPodium(state.dailyPodium, rank, total);
    return next === state.dailyPodium ? state : { dailyPodium: next };
  }),

  // ── checkDailyLogin ───────────────────────────────────────
  // Appelé au montage de l'app. Retourne true si c'est une nouvelle journée.
  checkDailyLogin: () => {
    const { lastPlayedDate, dailyStreak } = get();
    const today     = todayISO();
    const yesterday = yesterdayISO();

    // Reset quotidien (bonus, jetons amis, grilles Forestier, pub) : voir rolloverDailyLimits.
    get().rolloverDailyLimits();

    if (lastPlayedDate === today) return false; // Déjà compté aujourd'hui

    let newStreak: number;
    if (lastPlayedDate === yesterday) {
      // Jours consécutifs → streak+1
      newStreak = dailyStreak + 1;
    } else {
      // Rupture → remise à 1
      newStreak = 1;
    }

    // Habitué (Lot 8) : jours joués d'affilée. La série et son RECORD avancent ensemble ; la série retombe à 1
    // après une rupture, le record ne baisse jamais.
    set(state => ({
      // Lot D : un jour de plus où le joueur s'est connecté (checkDailyLogin ne passe ici qu'une fois par jour)
      stats: { ...state.stats, daysPlayed: state.stats.daysPlayed + 1 },
      dailyStreak: newStreak,
      lastPlayedDate: today,
      loyaltyStreak: newStreak,
      loyaltyBest: Math.max(state.loyaltyBest, newStreak),
    }));
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
  submitDailyResult: (date, success, timeMs, league) => {
    set(state => {
      // Incrémenter les compteurs cumulatifs (chantier 5)
      const newDailyPlayed = state.stats.dailyPlayed + 1;
      const newDailyWon    = success ? state.stats.dailyWon + 1 : state.stats.dailyWon;
      // Lot D : statistiques PAR LIGUE (parties, victoires, meilleur temps). Sans ligue (ancien appelant) : globaux seuls.
      const leagueStats = league === 'pousse'
        ? {
            dailyPlayedPousse: state.stats.dailyPlayedPousse + 1,
            dailyWonPousse: state.stats.dailyWonPousse + (success ? 1 : 0),
            bestDailyTimeMsPousse: success && timeMs != null && timeMs > 0
              ? (state.stats.bestDailyTimeMsPousse > 0 ? Math.min(state.stats.bestDailyTimeMsPousse, timeMs) : timeMs)
              : state.stats.bestDailyTimeMsPousse,
          }
        : league === 'grand_chene'
          ? {
              dailyPlayedGrandChene: state.stats.dailyPlayedGrandChene + 1,
              dailyWonGrandChene: state.stats.dailyWonGrandChene + (success ? 1 : 0),
              bestDailyTimeMsGrandChene: success && timeMs != null && timeMs > 0
                ? (state.stats.bestDailyTimeMsGrandChene > 0 ? Math.min(state.stats.bestDailyTimeMsGrandChene, timeMs) : timeMs)
                : state.stats.bestDailyTimeMsGrandChene,
            }
          : {};

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
          stats: { ...state.stats, ...leagueStats, dailyPlayed: newDailyPlayed, dailyWon: newDailyWon },
        };
      } else {
        // Échec : reset le streak mais on conserve le record.
        // `lastDailyChallengeDate` est écrit AUSSI sur un échec (Lot A) : sans lui, `isDailyToday` restait faux
        // et le Journalier se rejouait après un échec ou un abandon. Une seule partie par jour.
        return {
          dailyChallengeStatus: 'failed' as const,
          lastDailyChallengeDate: date,
          dailyChallengeStreak: 0,
          dailyChallengeTimeMs: null,
          stats: { ...state.stats, ...leagueStats, dailyPlayed: newDailyPlayed, dailyWon: newDailyWon },
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

  // ── Herbier de la Forêt ───────────────────────────────────
  markTreeCardsSeen: () => {
    const state = get();
    const next = markCardsSeen(state.collectedTreeCardIds, state.seenTreeCardIds);
    if (next === state.seenTreeCardIds) return; // rien de nouveau : aucun rendu
    set({ seenTreeCardIds: [...next] });
  },

  collectTreeCard: (cardId) => set(state => ({
    collectedTreeCardIds: state.collectedTreeCardIds.includes(cardId)
      ? state.collectedTreeCardIds
      : [...state.collectedTreeCardIds, cardId],
  })),

  // ── Herbier : plantation payante et cartes gratuites (Progression v2, C6) ──
  plantTreeCard: (cardId) => {
    const state = get();
    const open = getOpenRegions(
      region => isFeatureUnlocked(getRegionFeature(region)!, { levelsCompleted: state.levelsCompleted }),
      false,
    );
    const check = checkPlant(cardId, ALL_TREE_CARDS, state.collectedTreeCardIds, open, state.seeds);
    if (!check.ok) return { ok: false, reason: check.reason as PlantRefusal, cost: check.cost };
    // Un seul set() : graines ET carte ensemble. Pas de carte sans paiement, pas de paiement sans carte.
    set({
      seeds: state.seeds - check.cost,
      stats: { ...state.stats, seedsSpent: state.stats.seedsSpent + check.cost },
      collectedTreeCardIds: mergeCollectedIds(state.collectedTreeCardIds, [cardId]),
    });
    return { ok: true, cost: check.cost };
  },

  grantChapterCards: () => {
    if (!PROGRESSION_V2) return [];
    const state = get();
    // Seuls les chapitres RÉCOMPENSÉS (levelsCompleted atteint) qui n'ont pas encore donné leur carte.
    const due = state.rewardedChapters.filter(id => !state.chapterCardsGranted.includes(id)).sort((a, b) => a - b);
    if (due.length === 0) return [];
    let owned = state.collectedTreeCardIds;
    const granted: number[] = [];
    const doneChapters: number[] = [];
    for (const chapterId of due) {
      const open = getOpenRegions(
        region => isFeatureUnlocked(getRegionFeature(region)!, { levelsCompleted: state.levelsCompleted }),
        false,
      );
      const card = pickChapterCard(ALL_TREE_CARDS, owned, getChapterCardRegion(chapterId), open);
      // Même sans carte à offrir (collection épuisée), le chapitre est marqué : on ne réessaie pas.
      doneChapters.push(chapterId);
      if (card) { owned = mergeCollectedIds(owned, [card.id]); granted.push(card.id); }
    }
    set({
      collectedTreeCardIds: owned,
      chapterCardsGranted: mergeRewardedChapters(state.chapterCardsGranted, doneChapters),
    });
    return granted;
  },

  grantOnfCard: (countBefore, countAfter) => {
    if (!crossedOnfCardThreshold(countBefore, countAfter)) return null;
    const state = get();
    const open = getOpenRegions(
      region => isFeatureUnlocked(getRegionFeature(region)!, { levelsCompleted: state.levelsCompleted }),
      false,
    );
    const card = pickChapterCard(ALL_TREE_CARDS, state.collectedTreeCardIds, 'france', open);
    if (!card) return null;
    set({ collectedTreeCardIds: mergeCollectedIds(state.collectedTreeCardIds, [card.id]) });
    return card.id;
  },

  // ── Mode ONF ──────────────────────────────────────────────
  incrementOnfSolved: () => set(state => ({
    onfSolvedCount: state.onfSolvedCount + 1,
  })),

  setLastOnfCompoKey: (key) => set({ lastOnfCompoKey: key }),

  markOnfChallengeCompleted: (challengeId) => set(state => {
    if (state.completedOnfChallengeIds.includes(challengeId)) return state;
    return {
      completedOnfChallengeIds: [...state.completedOnfChallengeIds, challengeId],
      onfSolvedCount: state.onfSolvedCount + 1,
    };
  }),

  // ── Victoire ONF avec compteurs badges ─────────────────────
  recordOnfVictory: (challengeId, failCount, elapsedMs) => set(state => {
    const alreadyCompleted = state.completedOnfChallengeIds.includes(challengeId);
    const newPerfectCount = (!alreadyCompleted && failCount === 0)
      ? state.stats.onfPerfectCount + 1
      : state.stats.onfPerfectCount;
    const newSpeedCount = (!alreadyCompleted && elapsedMs < 120_000)
      ? state.stats.onfSpeedCount + 1
      : state.stats.onfSpeedCount;
    return {
      completedOnfChallengeIds: alreadyCompleted
        ? state.completedOnfChallengeIds
        : [...state.completedOnfChallengeIds, challengeId],
      onfSolvedCount: alreadyCompleted ? state.onfSolvedCount : state.onfSolvedCount + 1,
      stats: {
        ...state.stats,
        onfPerfectCount: newPerfectCount,
        onfSpeedCount:   newSpeedCount,
        // Lot D : meilleur temps du Forestier (toute grille, y compris un rejeu ; 0 = aucun)
        bestOnfTimeMs: elapsedMs > 0
          ? (state.stats.bestOnfTimeMs > 0 ? Math.min(state.stats.bestOnfTimeMs, elapsedMs) : elapsedMs)
          : state.stats.bestOnfTimeMs,
      },
    };
  }),

  // ── Victoire daily (refonte badges) ──────────────────────
  recordDailyVictory: (elapsedMs) => set(state => {
    const DAILY_SPEED_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
    return {
      stats: {
        ...state.stats,
        dailyPerfectCount: state.stats.dailyPerfectCount + 1, // toujours parfait (1 seule validation)
        dailySpeedCount: elapsedMs < DAILY_SPEED_THRESHOLD_MS
          ? state.stats.dailySpeedCount + 1
          : state.stats.dailySpeedCount,
      },
    };
  }),

  // ── Briefing ONF ──────────────────────────────────────────
  markOnfBriefingSeen: () => set({ hasSeenOnfBriefing: true }),

  // ── Compteur quotidien ONF ────────────────────────────────
  incrementOnfDaily: () => {
    // Passe d'abord au jour courant : une partie jouée après minuit (app restée ouverte) ne compte pas dans la veille.
    get().rolloverDailyLimits();
    set(state => ({ onfDailyCount: state.onfDailyCount + 1 }));
  },

  // ── Passage au jour courant des limites quotidiennes (Lot A) ─
  // Si les compteurs sont d'un autre jour : remise à neuf (bonus, jetons Duel, grilles Forestier, pub).
  // Appelée à l'ouverture (checkDailyLogin), puis avant chaque lecture/écriture sensible, de sorte que
  // l'app restée ouverte à minuit change de jour sans redémarrage. Sans effet si les compteurs sont du jour.
  rolloverDailyLimits: () => {
    const today = todayLocalISO();
    if (isLimitsOfDay(get(), today)) return false;
    const fresh = createFreshDailyLimits(today);
    set({ ...fresh, dailyBonusUses: fresh.dailyBonusUses as Record<BonusId, number> });
    return true;
  },

  // ── Dépense de bonus journalier (chantier 4) ──────────────
  spendBonus: (bonusId) => {
    get().rolloverDailyLimits();
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

  // ── Pub volontaire regardée ───────────────────────────────
  // Appelée APRÈS le visionnage complet. Le plafond quotidien de chaque emplacement est dans `adRewards.ts`.
  //  - bonus_* : le bonus doit être épuisé (sinon la pub ne servirait à rien : refus, plafond non consommé) ;
  //    il repasse à BONUS_USES_PER_DAY. Refusé aux premium (bonus déjà illimités) ;
  
  // Aucune pub ne donne de graines, de grille du Forestier ni de jeton de Duel.
  claimAdReward: (placement) => {
    get().rolloverDailyLimits();
    const s = get();
    if (s.isPremium && !isPlacementAvailableToPremium(placement)) return false;

    const nextViews = addAdView(s.adViews, placement);
    if (nextViews === s.adViews) return false; // plafond du jour atteint
    // Lot D : cumul des pubs regardées, tous emplacements confondus
    const watched = { ...s.stats, adsWatched: s.stats.adsWatched + 1 };

    switch (placement) {
      case 'bonus_reveal_cell':
      case 'bonus_instinct': {
        const bonusId: BonusId = placement === 'bonus_reveal_cell' ? 'reveal_cell' : 'instinct';
        if ((s.dailyBonusUses[bonusId] ?? 0) > 0) return false;
        set({ adViews: nextViews, stats: watched, dailyBonusUses: { ...s.dailyBonusUses, [bonusId]: BONUS_USES_PER_DAY } });
        return true;
      }
      case 'onf_recharge': {
        // Le quota du jour doit être épuisé (sinon la vidéo ne servirait à rien : refus, plafond non consommé).
        // La recharge s'inscrit dans `adViews.onf_recharge` (1 par jour) : `getOnfRemaining` y ajoute +3 défis.
        // `onfDailyCount` ne change pas (cumul qui ne baisse jamais, sûr à la fusion local / cloud).
        const remaining = getOnfRemaining({
          onfDailyCount: s.onfDailyCount,
          exempt: false,
          onfRecharges: getAdViews(s.adViews, 'onf_recharge'),
        });
        if (remaining > 0) return false;
        set({ adViews: nextViews, stats: watched });
        return true;
      }
      default:
        set({ adViews: nextViews, stats: watched });
        return true;
    }
  },}));

// ── Helpers privés ────────────────────────────────────────────────────────────

/** Vérifie si dateB est le jour suivant de dateA (format "YYYY-MM-DD") */
function isNextDay(dateA: string, dateB: string): boolean {
  if (!dateA || !dateB) return false;
  const a = new Date(dateA + 'T00:00:00Z');
  const b = new Date(dateB + 'T00:00:00Z');
  const diffMs = b.getTime() - a.getTime();
  return diffMs === 86400000; // Exactement 1 jour
}
