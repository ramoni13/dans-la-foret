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

const STORAGE_KEY = 'dlf_player_v1';
const AUDIO_STORAGE_KEY = 'dlf_audio_v1';

// Sous-ensemble de l'audioStore à persister
interface PersistedAudioState {
  ingameEnabled: boolean;
  menuEnabled: boolean;
  volume: number;
  selectedIngameTrackId: string;
  selectedMenuTrackId: string;
}

// Sous-ensemble du store à persister (on exclut les fonctions)
interface PersistedPlayerState {
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
    speedBadgeHits: Record<string, number>;
  };
  // Badges
  earnedBadges: string[];
  badgeShowcase: string[];
  unlockedBonuses: string[];
  unlockedThemes: string[];
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
  // Amis défiés (pour badge social_poignee / social_cirque)
  challengedFriendIds: string[];
}

/** Extrait le sous-ensemble persistable depuis l'état Zustand courant */
function extractPersistable(state: ReturnType<typeof usePlayerStore.getState>): PersistedPlayerState {
  return {
    seeds:               state.seeds,
    completedChallenges: state.completedChallenges,
    isPremium:           state.isPremium,
    username:            state.username,
    language:            state.language,
    stats:               state.stats,
    earnedBadges:        state.earnedBadges,
    badgeShowcase:       state.badgeShowcase.filter(Boolean) as string[],
    unlockedBonuses:     state.unlockedBonuses as string[],
    unlockedThemes:      state.unlockedThemes,
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
    challengedFriendIds:       state.challengedFriendIds,
  };
}

export function useStorage() {
  // saveTimeout est partagé entre les subscribers et le cleanup
  const saveTimeoutRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Chargement au démarrage ──────────────────────────────────────────────────
  // S'exécute UNE SEULE FOIS au montage — pas de dépendances variables.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!raw) return;
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
              speedBadgeHits:           (saved.stats as any)?.speedBadgeHits  ?? {},
              abandonCount:             (saved.stats as any)?.abandonCount    ?? {},
              // Nouveaux champs (chantier 5)
              dailyPlayed:              (saved.stats as any)?.dailyPlayed              ?? 0,
              dailyWon:                 (saved.stats as any)?.dailyWon                 ?? 0,
              friendPlayed:             (saved.stats as any)?.friendPlayed             ?? 0,
              avgResolutionMs:          (saved.stats as any)?.avgResolutionMs          ?? 0,
              totalResolutionCount:     (saved.stats as any)?.totalResolutionCount     ?? 0,
            },
            earnedBadges:    saved.earnedBadges    ?? [],
            badgeShowcase:   (saved.badgeShowcase  ?? []) as [string?, string?, string?],
            unlockedBonuses: (saved.unlockedBonuses ?? []) as import('../constants/bonus').BonusId[],
            unlockedThemes:  saved.unlockedThemes  ?? [],
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
            challengedFriendIds:    (saved as any).challengedFriendIds ?? [],
          });
          // Synchroniser immédiatement les musiques débloquées depuis les badges chargés
          useAudioStore.getState().syncOwnedFromBadges(saved.earnedBadges ?? []);
        } catch {
          console.warn('[useStorage] Données corrompues, réinitialisation.');
        }
      })
      .catch(err => console.warn('[useStorage] Erreur lecture:', err));

    // ── Chargement état audio ────────────────────────────────────────────────
    AsyncStorage.getItem(AUDIO_STORAGE_KEY)
      .then(rawAudio => {
        if (!rawAudio) return;
        try {
          const savedAudio: PersistedAudioState = JSON.parse(rawAudio);
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

    // ── Sauvegarde audio via subscribe ──────────────────────────────────────
    const unsubscribeAudio = useAudioStore.subscribe((newA, prevA) => {
      const changed =
        newA.ingameEnabled          !== prevA.ingameEnabled          ||
        newA.menuEnabled            !== prevA.menuEnabled            ||
        newA.volume                 !== prevA.volume                 ||
        newA.selectedIngameTrackId  !== prevA.selectedIngameTrackId  ||
        newA.selectedMenuTrackId    !== prevA.selectedMenuTrackId;

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
        newState.unlockedBonuses.length     !== prevState.unlockedBonuses.length     ||
        newState.unlockedThemes.length      !== prevState.unlockedThemes.length      ||
        newState.badgeShowcase.join(',')    !== prevState.badgeShowcase.join(',')    ||
        // Stats : comparer les valeurs numériques directes
        newState.stats.totalSolved              !== prevState.stats.totalSolved              ||
        newState.stats.currentStreak            !== prevState.stats.currentStreak            ||
        newState.stats.longestStreak            !== prevState.stats.longestStreak            ||
        newState.stats.noErrorStreak            !== prevState.stats.noErrorStreak            ||
        newState.stats.friendWins               !== prevState.stats.friendWins               ||
        newState.stats.totalFriendsInvited      !== prevState.stats.totalFriendsInvited      ||
        newState.stats.topDEJCount              !== prevState.stats.topDEJCount              ||
        newState.stats.improvedChallengesCount  !== prevState.stats.improvedChallengesCount  ||
        JSON.stringify(newState.stats.speedBadgeHits) !== JSON.stringify(prevState.stats.speedBadgeHits) ||
        newState.stats.seasonalChallengesPlayed !== prevState.stats.seasonalChallengesPlayed ||
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
        newState.earnedBadges.length            !== prevState.earnedBadges.length;

      if (!changed) return;

      // Synchroniser les musiques débloquées quand de nouveaux badges sont obtenus
      if (newState.earnedBadges.length !== prevState.earnedBadges.length) {
        useAudioStore.getState().syncOwnedFromBadges(newState.earnedBadges);
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
