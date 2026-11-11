// ============================================================
// SERVICE DES TROPHÉES — évaluation et attribution (Progression v2, C8 / Lot 8)
//
// Point d'entrée UNIQUE pour décerner des trophées après une partie (Solo, Journalier, Forestier, Duel,
// plantation de l'Herbier, fin de chapitre). Les écrans n'ont plus à connaître ni les séries, ni les
// surprises, ni le trophée final : ils appellent `awardEarnedTrophies` et reçoivent la liste des NOUVEAUX
// trophées, déjà inscrits dans le store (un seul `awardBadges` en lot, comme l'exige la règle transverse).
//
// Aucun « objectif actif » : tout trophée dont la condition est remplie est décerné.
// ============================================================

import { usePlayerStore } from '../store/playerStore';
import { getTotalOnfChallenges } from './onfChallengeService';
import { BADGE_MAP } from '../constants/badges';
import {
  SurpriseContext,
  TrophyPlayerState,
  buildTrophyCounters,
  evaluateSurprises,
} from '../constants/trophyEngine';
import {
  TROPHY_SERIES,
  evaluateFinalTrophy,
  evaluateSeriesTrophies,
  getClosestTrophies,
  getSeries,
} from '../constants/trophies';

/** Sous-ensemble de l'état du store utilisé pour construire les compteurs. */
type PlayerSnapshot = ReturnType<typeof usePlayerStore.getState>;

/** Compteurs de séries depuis l'état du store (lecture seule). */
export function readTrophyState(s: PlayerSnapshot): TrophyPlayerState {
  return {
    challengeStars: s.challengeStars,
    bestStarStreak: s.bestStarStreak,
    starStreak: s.starStreak,
    quickFirstWins: s.quickFirstWins,
    improvedStarChallengeIds: s.improvedStarChallengeIds,
    dailyWins: s.stats.dailyWon,
    longestDailyChallengeStreak: s.longestDailyChallengeStreak,
    dailyPodium: s.dailyPodium,
    onfSolvedCount: s.onfSolvedCount,
    onfPerfectCount: s.stats.onfPerfectCount,
    onfSpeedCount: s.stats.onfSpeedCount,
    friendWins: s.stats.friendWins,
    challengedFriendCount: s.challengedFriendIds.length,
    collectedCardCount: s.collectedTreeCardIds.length,
    loyaltyBest: s.loyaltyBest,
    loyaltyStreak: s.loyaltyStreak,
  };
}

/**
 * Trophées à décerner MAINTENANT (sans les inscrire) : séries atteintes, trophée final, et surprises si un
 * contexte de partie est fourni. Idempotent : ne renvoie jamais un trophée déjà possédé.
 */
export function computeEarnedTrophies(
  state: PlayerSnapshot,
  surprise?: Omit<SurpriseContext, 'earned'>,
): string[] {
  const counters = buildTrophyCounters(readTrophyState(state), getTotalOnfChallenges());
  const earned = state.earnedBadges;
  const out = [
    ...evaluateSeriesTrophies(counters, earned),
    ...evaluateFinalTrophy(state.levelsCompleted, earned),
    ...(surprise ? evaluateSurprises({ ...surprise, earned }) : []),
  ];
  // Un identifiant inconnu du catalogue ne doit jamais entrer dans le store
  return out.filter((id, i) => BADGE_MAP[id] && out.indexOf(id) === i);
}

/**
 * Évalue et INSCRIT les trophées atteints, en un seul `awardBadges` (zéro rendu intermédiaire), et renvoie
 * les nouveaux identifiants (pour la file de toasts et la synchronisation Firestore).
 */
export function awardEarnedTrophies(surprise?: Omit<SurpriseContext, 'earned'>): string[] {
  const store = usePlayerStore.getState();
  const fresh = computeEarnedTrophies(store, surprise);
  if (fresh.length > 0) store.awardBadges(fresh);
  // Les titres de musique offerts par ces trophées (palier « pierre » de 5 séries) ou par une fin de chapitre
  // sont mémorisés ici : un titre débloqué ne se perd jamais.
  usePlayerStore.getState().syncUnlockedMusic();
  return fresh;
}

/**
 * « Prochains trophées » pour la VictoryModal : les `limit` (3) séries les plus proches, avec la valeur AVANT la
 * partie pour animer le « +N ».
 *
 * `before` : compteurs AVANT la partie (lus avant `recordSoloStars` / `markChallengeCompleted`). Les trophées
 * obtenus CE tour (`justEarned`) sont exclus de `earned` pour que leur série affiche encore le palier qui vient
 * d'être franchi (avec ✓), plutôt que de sauter directement au suivant.
 */
export function computeNextTrophies(
  after: PlayerSnapshot,
  before: TrophyPlayerState,
  justEarned: readonly string[],
  limit = 3,
) {
  const total = getTotalOnfChallenges();
  const countersAfter = buildTrophyCounters(readTrophyState(after), total);
  const countersBefore = buildTrophyCounters(before, total);
  const earnedWithoutNew = after.earnedBadges.filter(id => !justEarned.includes(id));
  const closest = getClosestTrophies(countersAfter, earnedWithoutNew, limit);
  return closest.map(item => {
    const series = getSeries(item.seriesId);
    const prev = series ? Math.min(series.read(countersBefore), item.target) : item.current;
    return { ...item, previousValue: item.seriesId === 'podium' ? item.current : prev };
  });
}

/** Séries du catalogue (réexport pratique pour les écrans). */
export { TROPHY_SERIES };