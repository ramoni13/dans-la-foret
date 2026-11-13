// ============================================================
// HOOK DE PERSISTANCE — useStorage.ts
// Charge et sauvegarde le playerStore dans AsyncStorage.
// À appeler UNE SEULE FOIS dans le layout racine (_layout.tsx).
//
// Clé de stockage : 'dlf_player_v1'
//
// ARCHITECTURE :
//   - Le CHARGEMENT se fait via useEffect au premier mount (une seule fois).
//   - La SAUVEGARDE utilise usePlayerStore.subscribe() (API Zustand vanilla)
//     pour ne jamais créer de dépendances React instables qui bouclent.
//     Elle est déclenchée uniquement quand les données persistables changent.
// ============================================================

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayerStore } from '../store/playerStore';
import { useAudioStore } from '../store/audioStore';
import { Lang, getSystemLocale } from '../i18n/locale';
import { PROGRESSION_V2 } from '../constants/featureFlags';
import { computeLevelProgress, mergeChallengeStars, mergeRewardedChapters, needsProgressionReset } from '../constants/progression';
import { mergeCeremonyIds } from '../constants/ceremonies';
import { mergeCollectedIds } from '../constants/herbier';
import { createFreshDailyLimits, sanitizeDailyLimits } from '../constants/dailyLimits';
import { readLotDStats } from '../constants/profileDefaults';
import type { MusicProgress } from '../store/audioStore';

const STORAGE_KEY = 'dlf_player_v1';
const AUDIO_STORAGE_KEY = 'dlf_audio_v1';

// Sous-ensemble de l'audioStore à persister
interface PersistedAudioState {
  ingameEnabled: boolean;
  menuEnabled: boolean;
  volume: number;
  selectedIngameTrackId: string;
  selectedMenuTrackId: string;
  /** IDs des musiques déjà possédées au dernier démarrage (évite de re-déclencher la modale) */
  ownedTrackIds?: string[];
}

// Sous-ensemble du store à persister (on exclut les fonctions)
interface PersistedPlayerState {
  // Progression v2 (section D) — absent d'un profil pré-v2
  progressionVersion?: number;
  challengeStars?: Record<string, number>;
  levelsCompleted?: number;
  pendingCeremonies?: string[];
  seenCeremonies?: string[];
  rewardedChapters?: number[];
  chapterCardsGranted?: number[];
  newFeatureBadges?: string[];
  unlockedMusicIds?: string[];
  starStreak?: number;
  quickFirstWins?: number;
  improvedStarChallengeIds?: string[];
  loyaltyStreak?: number;
  loyaltyBest?: number;
  bestStarStreak?: number;
  dailyPodium?: { top10Percent: number; top3: number; first: number };
  seeds: number;
  completedChallenges: string[];
  isPremium: boolean;
  username: string;
  language: string;
  stats: {
    totalSolved: number;
    bestTimes: Record<string, number>;
    currentStreak: number;
    longestStreak: number;
    noErrorStreak: number;
    friendWins: number;
    totalFriendsInvited: number;
    topDEJCount: number;
    sameChallengePlays: Record<string, number>;
    failCount: Record<string, number>;
    improvedChallengesCount: number;
    seasonalChallengesPlayed: number;
  };
  // Badges
  earnedBadges: string[];
  badgeShowcase: string[];
  // Streak quotidien
  dailyStreak: number;
  lastPlayedDate: string;
  // Tutoriels bonus masqués
  bonusTutorialDismissed: string[];
  // Effet visuel en jeu
  visualEffect: string;
  // Défi journalier
  dailyChallengeStreak: number;
  longestDailyChallengeStreak: number;
  lastDailyChallengeDate: string;
  dailyChallengeStatus: string | null;
  // Anti-triche
  challengeStartedAt: Record<string, number>;
  // Notifications amis
  friendNotifBadgeEnabled: boolean;
  // Mode ONF
  onfSolvedCount: number;
  /** Cartes de l'Herbier possédées (source de vérité depuis la Progression v2, Lot 7). */
  collectedTreeCardIds?: number[];
  seenTreeCardIds?: number[];
  // Amis défiés (pour badge social_poignee / social_cirque)
  challengedFriendIds: string[];
  /** Défis entre amis déjà comptés dans les statistiques (Lot D). */
  countedDuelIds?: string[];
  duelWinStreak?: number;
  // Utilisations journalières des bonus
  dailyBonusUses: Record<string, number>;
  lastBonusResetDate: string | null;
  // Limites quotidiennes (Lot A) : persistées pour survivre à un redémarrage
  onfDailyCount?: number;
  lastOnfDailyDate?: string;
  challengeCountToday?: number;
  friendChallengeTokens?: number;
  /** Pubs récompensées regardées aujourd'hui, par emplacement (Lot B). */
  adViews?: Record<string, number>;
  /** @deprecated Avant le Lot B (recharge unique par jour) : converti en `adViews` au chargement. */
  watchAdUsedToday?: boolean;
}

/** Extrait le sous-ensemble persistable depuis l'état Zustand courant */
function extractPersistable(state: ReturnType<typeof usePlayerStore.getState>): PersistedPlayerState {
  return {
    progressionVersion:       state.progressionVersion,
    challengeStars:           state.challengeStars,
    levelsCompleted:          state.levelsCompleted,
    pendingCeremonies:        state.pendingCeremonies,
    seenCeremonies:           state.seenCeremonies,
    rewardedChapters:         state.rewardedChapters,
    chapterCardsGranted:      state.chapterCardsGranted,
    newFeatureBadges:         state.newFeatureBadges,
    unlockedMusicIds:         state.unlockedMusicIds,
    starStreak:               state.starStreak,
    quickFirstWins:           state.quickFirstWins,
    improvedStarChallengeIds: state.improvedStarChallengeIds,
    loyaltyStreak:            state.loyaltyStreak,
    loyaltyBest:              state.loyaltyBest,
    bestStarStreak:           state.bestStarStreak,
    dailyPodium:              state.dailyPodium,
    seeds:               state.seeds,
    completedChallenges: state.completedChallenges,
    isPremium:           state.isPremium,
    username:            state.username,
    language:            state.language,
    stats:               state.stats,
    earnedBadges:        state.earnedBadges,
    badgeShowcase:       state.badgeShowcase.filter(Boolean) as string[],
    dailyStreak:         state.dailyStreak,
    lastPlayedDate:      state.lastPlayedDate,
    bonusTutorialDismissed: state.bonusTutorialDismissed as string[],
    visualEffect:          state.visualEffect,
    dailyChallengeStreak:           state.dailyChallengeStreak,
    longestDailyChallengeStreak:    state.longestDailyChallengeStreak,
    lastDailyChallengeDate:         state.lastDailyChallengeDate,
    dailyChallengeStatus:      state.dailyChallengeStatus,
    challengeStartedAt:        state.challengeStartedAt,
    friendNotifBadgeEnabled:   state.friendNotifBadgeEnabled,
    onfSolvedCount:            state.onfSolvedCount,
    collectedTreeCardIds:      state.collectedTreeCardIds,
    seenTreeCardIds:           state.seenTreeCardIds,
    challengedFriendIds:       state.challengedFriendIds,
    countedDuelIds:            state.countedDuelIds,
    duelWinStreak:             state.duelWinStreak,
    dailyBonusUses:            state.dailyBonusUses,
    lastBonusResetDate:        state.lastBonusResetDate,
    challengeCountToday:       state.challengeCountToday,
    onfDailyCount:             state.onfDailyCount,
    lastOnfDailyDate:          state.lastOnfDailyDate,
    friendChallengeTokens:     state.friendChallengeTokens,
    adViews:                   state.adViews as Record<string, number>,
  };
}

/** Progression lue par `audioStore.syncOwnedMusic` : niveaux validés, trophées, titres mémorisés. */
function readMusicProgress(): MusicProgress {
  const s = usePlayerStore.getState();
  return {
    levelsCompleted: s.levelsCompleted,
    earnedTrophies: s.earnedBadges,
    unlockedIds: s.unlockedMusicIds,
  };
}

export function useStorage() {
  // saveTimeout est partagé entre les subscribers et le cleanup
  const saveTimeoutRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flag : true une fois le chargement initial terminé.
  // Tant qu'il est false, syncOwnedMusic est appelé en mode silencieux
  // pour éviter que la restauration des badges au démarrage déclenche la modale.
  const bootDoneRef = useRef(false);

  // ── Chargement au démarrage ──────────────────────────────────────────────────
  // S'exécute UNE SEULE FOIS au montage — pas de dépendances variables.
  useEffect(() => {
    // ── Chargement séquencé : player d'abord, puis audio, puis sync badges ──
    // Les deux lectures sont lancées en parallèle mais syncOwnedMusic
    // est appelé APRÈS hydrate() pour garantir que ownedTrackIds reflète
    // bien la progression du joueur, quelle que soit l'ordre de résolution.
    const playerPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!raw) return null;
        try {
          const saved: PersistedPlayerState = JSON.parse(raw);
          usePlayerStore.setState({
            seeds:                saved.seeds               ?? 3,
            completedChallenges:  saved.completedChallenges ?? [],
            isPremium:            saved.isPremium           ?? false,
            username:             saved.username            ?? 'Joueur',
            language:            (saved.language as Lang)  ?? getSystemLocale(),
            stats: {
              totalSolved:              saved.stats?.totalSolved              ?? 0,
              bestTimes:                saved.stats?.bestTimes                ?? {},
              currentStreak:            saved.stats?.currentStreak            ?? 0,
              longestStreak:            saved.stats?.longestStreak            ?? 0,
              noErrorStreak:            saved.stats?.noErrorStreak            ?? 0,
              friendWins:               saved.stats?.friendWins               ?? 0,
              totalFriendsInvited:      saved.stats?.totalFriendsInvited      ?? 0,
              topDEJCount:              saved.stats?.topDEJCount              ?? 0,
              sameChallengePlays:       saved.stats?.sameChallengePlays       ?? {},
              failCount:                saved.stats?.failCount                ?? {},
              improvedChallengesCount:  saved.stats?.improvedChallengesCount  ?? 0,
              seasonalChallengesPlayed: saved.stats?.seasonalChallengesPlayed ?? 0,
              abandonCount:             (saved.stats as any)?.abandonCount    ?? {},
              // Nouveaux champs (chantier 5)
              dailyPlayed:              (saved.stats as any)?.dailyPlayed              ?? 0,
              dailyWon:                 (saved.stats as any)?.dailyWon                 ?? 0,
              friendPlayed:             (saved.stats as any)?.friendPlayed             ?? 0,
              avgResolutionMs:          (saved.stats as any)?.avgResolutionMs          ?? 0,
              totalResolutionCount:     (saved.stats as any)?.totalResolutionCount     ?? 0,
              // Compteurs ONF et daily (refonte badges)
              onfPerfectCount:          (saved.stats as any)?.onfPerfectCount          ?? 0,
              onfSpeedCount:            (saved.stats as any)?.onfSpeedCount            ?? 0,
              dailyPerfectCount:        (saved.stats as any)?.dailyPerfectCount        ?? 0,
              dailySpeedCount:          (saved.stats as any)?.dailySpeedCount          ?? 0,
              // Lot D : compteurs ajoutés ; une sauvegarde antérieure n'a pas ces champs : 0
              ...readLotDStats(saved.stats),
            },
            earnedBadges:    saved.earnedBadges    ?? [],
            badgeShowcase:   (saved.badgeShowcase  ?? []) as [string?, string?, string?],
            dailyStreak:     saved.dailyStreak     ?? 0,
            lastPlayedDate:  saved.lastPlayedDate  ?? '',
            bonusTutorialDismissed: (saved.bonusTutorialDismissed ?? []) as import('../constants/bonus').BonusId[],
            visualEffect: (saved.visualEffect ?? 'leaves') as import('../store/playerStore').VisualEffect,
            dailyChallengeStreak:        saved.dailyChallengeStreak        ?? 0,
            longestDailyChallengeStreak: (saved as any).longestDailyChallengeStreak ?? 0,
            lastDailyChallengeDate:      saved.lastDailyChallengeDate      ?? '',
            dailyChallengeStatus:   (saved.dailyChallengeStatus  ?? null) as 'pending' | 'in_progress' | 'success' | 'failed' | null,
            challengeStartedAt:     saved.challengeStartedAt     ?? {},
            friendNotifBadgeEnabled: saved.friendNotifBadgeEnabled ?? true,
            onfSolvedCount:         (saved as any).onfSolvedCount ?? 0,
            // Herbier : identifiants valides, sans doublon (valeurs corrompues écartées)
            collectedTreeCardIds:   mergeCollectedIds((saved as any).collectedTreeCardIds, undefined),
            // Sauvegarde sans ce champ (avant le badge) : les cartes déjà possédées sont considérées comme vues
            seenTreeCardIds:        mergeCollectedIds((saved as any).seenTreeCardIds ?? (saved as any).collectedTreeCardIds, undefined),
            challengedFriendIds:    (saved as any).challengedFriendIds ?? [],
            countedDuelIds:         Array.isArray((saved as any).countedDuelIds) ? (saved as any).countedDuelIds : [],
            duelWinStreak:          Math.max(0, Math.floor(Number((saved as any).duelWinStreak) || 0)),
            // Limites quotidiennes (Lots A et B) : relues via `sanitizeDailyLimits` (valeurs bornées ; ancien
            // `watchAdUsedToday` converti en `adViews`). `rolloverDailyLimits` les remet à neuf si elles datent
            // d'un autre jour. Une sauvegarde sans date (ou d'avant le Lot A) donne un jour neuf.
            ...(() => {
              const limits = sanitizeDailyLimits({
                ...saved,
                dailyBonusUses: (saved as any).dailyBonusUses
                  ? { reveal_cell: (saved as any).dailyBonusUses.reveal_cell ?? (saved as any).dailyBonusUses.highlight_valid_cells, instinct: (saved as any).dailyBonusUses.instinct }
                  : undefined,
              });
              return limits
                ? { ...limits, dailyBonusUses: limits.dailyBonusUses as Record<import('../constants/bonus').BonusId, number> }
                : { ...createFreshDailyLimits(''), lastBonusResetDate: null, lastOnfDailyDate: '', dailyBonusUses: { reveal_cell: 3, instinct: 3 } as Record<import('../constants/bonus').BonusId, number> };
            })(),
            // ── Progression v2 ──
            progressionVersion:       saved.progressionVersion ?? 0,
            challengeStars:           mergeChallengeStars(saved.challengeStars, undefined),
            levelsCompleted:          computeLevelProgress(saved.challengeStars).levelsCompleted,
            // Identifiants validés (valeurs corrompues écartées) ; une cérémonie vue ne revient jamais en file.
            pendingCeremonies:        mergeCeremonyIds(saved.pendingCeremonies, undefined).filter(id => !mergeCeremonyIds(saved.seenCeremonies, undefined).includes(id)),
            seenCeremonies:           mergeCeremonyIds(saved.seenCeremonies, undefined),
            rewardedChapters:         mergeRewardedChapters(saved.rewardedChapters, undefined),
            chapterCardsGranted:      mergeRewardedChapters(saved.chapterCardsGranted, undefined),
            newFeatureBadges:         saved.newFeatureBadges ?? [],
            unlockedMusicIds:         saved.unlockedMusicIds ?? [],
            starStreak:               saved.starStreak ?? 0,
            quickFirstWins:           saved.quickFirstWins ?? 0,
            improvedStarChallengeIds: saved.improvedStarChallengeIds ?? [],
            loyaltyStreak:            saved.loyaltyStreak ?? 0,
            loyaltyBest:              Math.max(saved.loyaltyBest ?? 0, saved.loyaltyStreak ?? 0),
            bestStarStreak:           Math.max(saved.bestStarStreak ?? 0, saved.starStreak ?? 0),
            dailyPodium:              { top10Percent: saved.dailyPodium?.top10Percent ?? 0, top3: saved.dailyPodium?.top3 ?? 0, first: saved.dailyPodium?.first ?? 0 },
          });
          // Limites quotidiennes : si la sauvegarde date d'un autre jour, remise à neuf tout de suite (la lecture
          // asynchrone peut finir après checkDailyLogin et réinstaller des compteurs périmés).
          usePlayerStore.getState().rolloverDailyLimits();
          // Progression v2 (C9) : sauvegarde locale pré-v2 → remise à zéro locale, une seule fois.
          // progressionVersion passe à 2 et est persisté ; la remise à zéro cloud est faite par _layout.tsx.
          if (PROGRESSION_V2 && needsProgressionReset(saved.progressionVersion)) {
            usePlayerStore.getState().resetProgression();
            return [];
          }
          if (PROGRESSION_V2) {
            // Le niveau suit les étoiles
            usePlayerStore.setState({ currentLevel: computeLevelProgress(saved.challengeStars).currentLevel });
          }
          return saved.earnedBadges ?? [];
        } catch {
          console.warn('[useStorage] Données corrompues, réinitialisation.');
          return null;
        }
      })
      .catch(err => { console.warn('[useStorage] Erreur lecture:', err); return null; });

    const audioPromise = AsyncStorage.getItem(AUDIO_STORAGE_KEY)
      .then(rawAudio => {
        if (!rawAudio) return;
        try {
          const savedAudio: PersistedAudioState = JSON.parse(rawAudio);
          // Pré-remplir ownedTrackIds avec les pistes déjà connues au dernier démarrage.
          // Cela évite que syncOwnedMusic() détecte à tort des "nouveaux déblocages"
          // et affiche la modale MusicUnlockModal à chaque lancement.
          if (savedAudio.ownedTrackIds && savedAudio.ownedTrackIds.length > 0) {
            useAudioStore.setState({ ownedTrackIds: savedAudio.ownedTrackIds });
          }
          useAudioStore.getState().hydrate({
            ingameEnabled:         savedAudio.ingameEnabled,
            menuEnabled:           savedAudio.menuEnabled,
            volume:                savedAudio.volume,
            selectedIngameTrackId: savedAudio.selectedIngameTrackId,
            selectedMenuTrackId:   savedAudio.selectedMenuTrackId,
          });
        } catch {
          console.warn('[useStorage] Données audio corrompues, réinitialisation.');
        }
      })
      .catch(err => console.warn('[useStorage] Erreur lecture audio:', err));

    // Synchroniser les musiques débloquées APRÈS les deux chargements :
    // silent=true → pas de modale au démarrage (pistes déjà connues du joueur)
    Promise.all([playerPromise, audioPromise]).then(() => {
      // Progression lue sur le store déjà hydraté (niveaux validés, trophées, titres mémorisés)
      useAudioStore.getState().syncOwnedMusic(readMusicProgress(), true);
      // Marquer le boot comme terminé : les appels suivants du subscriber
      // peuvent déclencher la modale (vrais nouveaux déblocages en jeu)
      bootDoneRef.current = true;
    });

    // ── Sauvegarde audio via subscribe ──────────────────────────────────────
    const unsubscribeAudio = useAudioStore.subscribe((newA, prevA) => {
      const changed =
        newA.ingameEnabled          !== prevA.ingameEnabled          ||
        newA.menuEnabled            !== prevA.menuEnabled            ||
        newA.volume                 !== prevA.volume                 ||
        newA.selectedIngameTrackId  !== prevA.selectedIngameTrackId  ||
        newA.selectedMenuTrackId    !== prevA.selectedMenuTrackId    ||
        newA.ownedTrackIds.length   !== prevA.ownedTrackIds.length;

      if (!changed) return;

      if (audioSaveTimeoutRef.current) clearTimeout(audioSaveTimeoutRef.current);
      audioSaveTimeoutRef.current = setTimeout(() => {
        const a = useAudioStore.getState();
        const toSave: PersistedAudioState = {
          ingameEnabled:         a.ingameEnabled,
          menuEnabled:           a.menuEnabled,
          volume:                a.volume,
          selectedIngameTrackId: a.selectedIngameTrackId,
          selectedMenuTrackId:   a.selectedMenuTrackId,
          // Persister les pistes possédées pour éviter de re-déclencher la modale au prochain démarrage
          ownedTrackIds:         a.ownedTrackIds,
        };
        AsyncStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(toSave))
          .catch(err => console.warn('[useStorage] Erreur sauvegarde audio:', err));
      }, 500);
    });

    // ── Sauvegarde via subscribe Zustand (hors cycle React) ─────────────────
    // subscribe() reçoit (newState, prevState). On compare les clés primitives
    // et les longueurs de tableaux pour décider si une sauvegarde est nécessaire.
    // Cela évite complètement les problèmes de référence d'objet des useEffect deps.
    const unsubscribe = usePlayerStore.subscribe((newState, prevState) => {
      // Comparaison légère : on ne sauvegarde que si quelque chose a vraiment changé
      const changed =
        newState.seeds               !== prevState.seeds               ||
        newState.isPremium           !== prevState.isPremium           ||
        newState.username            !== prevState.username            ||
        newState.language            !== prevState.language            ||
        newState.dailyStreak         !== prevState.dailyStreak         ||
        newState.lastPlayedDate      !== prevState.lastPlayedDate      ||
        newState.earnedBadges.length !== prevState.earnedBadges.length ||
        newState.completedChallenges.length !== prevState.completedChallenges.length ||
        newState.badgeShowcase.join(',')    !== prevState.badgeShowcase.join(',')    ||
        // Stats : toute action de statistique crée un NOUVEL objet stats (immuabilité) : la référence suffit et couvre
        // tous les compteurs (avant le Lot D, dailyPlayed, friendPlayed, onf* et daily* n'étaient pas surveillés).
        newState.stats                          !== prevState.stats                          ||
        newState.countedDuelIds                 !== prevState.countedDuelIds                 ||
        newState.duelWinStreak                  !== prevState.duelWinStreak                  ||
        newState.bonusTutorialDismissed.length  !== prevState.bonusTutorialDismissed.length ||
        newState.visualEffect                   !== prevState.visualEffect ||
        newState.dailyChallengeStreak           !== prevState.dailyChallengeStreak ||
        newState.longestDailyChallengeStreak    !== prevState.longestDailyChallengeStreak ||
        newState.lastDailyChallengeDate         !== prevState.lastDailyChallengeDate ||
        newState.dailyChallengeStatus           !== prevState.dailyChallengeStatus ||
        // Anti-triche : détecter changements dans le Record via référence
        newState.challengeStartedAt             !== prevState.challengeStartedAt ||
        newState.friendNotifBadgeEnabled        !== prevState.friendNotifBadgeEnabled ||
        newState.onfSolvedCount                 !== prevState.onfSolvedCount ||
        newState.challengedFriendIds.length     !== prevState.challengedFriendIds.length ||
        newState.earnedBadges.length            !== prevState.earnedBadges.length        ||
        JSON.stringify(newState.dailyBonusUses) !== JSON.stringify(prevState.dailyBonusUses) ||
        newState.lastBonusResetDate             !== prevState.lastBonusResetDate ||
        // Limites quotidiennes (Lot A)
        newState.challengeCountToday            !== prevState.challengeCountToday ||
        newState.onfDailyCount                  !== prevState.onfDailyCount ||
        newState.friendChallengeTokens          !== prevState.friendChallengeTokens ||
        newState.adViews                        !== prevState.adViews ||
        // Progression v2
        newState.progressionVersion             !== prevState.progressionVersion ||
        newState.challengeStars                 !== prevState.challengeStars ||
        newState.pendingCeremonies              !== prevState.pendingCeremonies ||
        newState.seenCeremonies                 !== prevState.seenCeremonies ||
        newState.rewardedChapters               !== prevState.rewardedChapters ||
        newState.chapterCardsGranted            !== prevState.chapterCardsGranted ||
        newState.collectedTreeCardIds           !== prevState.collectedTreeCardIds ||
        newState.seenTreeCardIds                !== prevState.seenTreeCardIds ||
        newState.newFeatureBadges               !== prevState.newFeatureBadges ||
        newState.unlockedMusicIds               !== prevState.unlockedMusicIds ||
        newState.starStreak                     !== prevState.starStreak ||
        newState.quickFirstWins                 !== prevState.quickFirstWins ||
        newState.improvedStarChallengeIds       !== prevState.improvedStarChallengeIds ||
        newState.loyaltyStreak                  !== prevState.loyaltyStreak ||
        newState.loyaltyBest                    !== prevState.loyaltyBest ||
        newState.bestStarStreak                 !== prevState.bestStarStreak ||
        newState.dailyPodium                    !== prevState.dailyPodium;

      if (!changed) return;

      // Synchroniser les musiques débloquées quand la progression change : fin de chapitre (niveaux validés),
      // nouveau trophée, ou titre déjà mémorisé. silent si le boot n'est pas terminé (chargement initial).
      if (
        newState.levelsCompleted !== prevState.levelsCompleted ||
        newState.earnedBadges.length !== prevState.earnedBadges.length ||
        newState.unlockedMusicIds !== prevState.unlockedMusicIds
      ) {
        useAudioStore.getState().syncOwnedMusic(readMusicProgress(), !bootDoneRef.current);
      }

      // Debounce 500 ms pour regrouper les écritures rapprochées (ex: awardBadges + addSeeds)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const toSave = extractPersistable(usePlayerStore.getState());
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
          .catch(err => console.warn('[useStorage] Erreur sauvegarde:', err));
      }, 500);
    });

    // Cleanup : annuler les subscribers et les timeouts en suspens
    return () => {
      unsubscribe();
      unsubscribeAudio();
      if (saveTimeoutRef.current)      clearTimeout(saveTimeoutRef.current);
      if (audioSaveTimeoutRef.current) clearTimeout(audioSaveTimeoutRef.current);
    };
  }, []); // [] = s'exécute une seule fois, jamais rebranché
}
