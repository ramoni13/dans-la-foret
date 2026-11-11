// ============================================================
// MOTEUR DES TROPHÉES — surprises + construction des compteurs (Progression v2, C8 / Lot 8)
//
// Remplace `badgeEngine.ts` : plus de pistes, d'« objectifs actifs », de `goalCounters` ni de séquence
// maîtresse. Tout trophée dont la condition est remplie est décerné.
//
// Deux responsabilités, toutes deux PURES (aucune dépendance React / Zustand / Firebase) :
//   1. `evaluateSurprises` : les 11 surprises liées à une partie (secrets, saisonniers, records) ;
//   2. `buildTrophyCounters` : assemble les compteurs lus par les séries à partir de l'état du joueur.
// Les séries et le trophée final sont évalués par `trophies.ts`.
// ============================================================

import { isInSeason, BADGE_DEFINITIONS } from './badges';
import { countThreeStarChallenges, countTotalStars } from './progression';
import { EMPTY_PODIUM, PodiumStats, TrophyCounters } from './trophies';

// ── Surprises liées à une partie solo ────────────────────────────────────────

export interface SurpriseContext {
  /** Heure de fin de partie. */
  playedAt: Date;
  /** Série de jours joués d'affilée (après la mise à jour du jour courant). */
  dailyStreak: number;
  /** Validations ratées pendant la partie. */
  failCount: number;
  /** Nombre de fois que ce défi a déjà été joué AVANT cette partie. */
  sameChallengePlaysBefore: number;
  /** Défis joués pendant la saison en cours (cumulé, partie courante comprise). */
  seasonalChallengesPlayed: number;
  /** Premier temps jamais enregistré sur ce défi. */
  isFirstRecord: boolean;
  /** Record du monde battu. */
  isWorldRecord: boolean;
  earned: readonly string[];
}

/**
 * Surprises à décerner après une partie solo. Idempotent. Conditions conservées TELLES QUELLES du système
 * de badges (spec C8 : « badges uniques, conservés tels quels »).
 */
export function evaluateSurprises(ctx: SurpriseContext): string[] {
  const have = new Set(ctx.earned);
  const out: string[] = [];
  const award = (id: string) => { if (!have.has(id)) { have.add(id); out.push(id); } };

  const hour = ctx.playedAt.getHours();
  const minute = ctx.playedAt.getMinutes();
  const day = ctx.playedAt.getDay(); // 0 = dimanche

  // Secrets
  if (hour === 0 && minute === 0) award('secret_fantome');                                   // minuit pile
  if (ctx.playedAt.getMonth() === 11 && ctx.playedAt.getDate() === 25) award('secret_noel'); // 25 décembre
  if (day === 0 && hour >= 7 && hour < 9) award('secret_paques');                             // dimanche matin
  if (ctx.sameChallengePlaysBefore + 1 >= 10) award('secret_boucle');                        // même défi, 10 fois
  if (ctx.failCount >= 5) award('secret_coeur_brise');                                       // 5 échecs avant de réussir

  // Régularité (surprises) : jouer la nuit / tôt, plusieurs jours de suite
  if ((hour >= 22 || hour < 6) && ctx.dailyStreak >= 3) award('regularite_lune');
  if (hour >= 6 && hour < 9 && ctx.dailyStreak >= 5) award('regularite_soleil');

  // Saisonniers : 5 défis joués pendant la saison en cours
  if (ctx.seasonalChallengesPlayed >= 5) {
    for (const badge of BADGE_DEFINITIONS) {
      if (badge.isSeasonal && isInSeason(badge, ctx.playedAt)) award(badge.id);
    }
  }

  // Records du monde
  if (ctx.isFirstRecord) award('record_first');
  if (ctx.isWorldRecord) award('record_mondial');

  return out;
}

// ── Compteurs lus par les séries ──────────────────────────────────────────────

/** Sous-ensemble de l'état du joueur nécessaire à la construction des compteurs. */
export interface TrophyPlayerState {
  challengeStars: Record<string, number>;
  bestStarStreak: number;
  starStreak: number;
  quickFirstWins: number;
  improvedStarChallengeIds: readonly string[];
  dailyWins: number;
  longestDailyChallengeStreak: number;
  dailyPodium: PodiumStats;
  onfSolvedCount: number;
  onfPerfectCount: number;
  onfSpeedCount: number;
  friendWins: number;
  challengedFriendCount: number;
  collectedCardCount: number;
  loyaltyBest: number;
  loyaltyStreak: number;
}

/**
 * Compteurs des séries depuis l'état du joueur. Tous sont des cumuls ou des RECORDS (qui ne baissent
 * jamais) : un trophée obtenu ne se « perd » pas quand une série en cours retombe à zéro.
 */
export function buildTrophyCounters(s: TrophyPlayerState, onfTotal: number): TrophyCounters {
  return {
    totalStars: countTotalStars(s.challengeStars),
    bestStarStreak: Math.max(s.bestStarStreak, s.starStreak),
    threeStarChallenges: countThreeStarChallenges(s.challengeStars),
    quickFirstWins: s.quickFirstWins,
    improvedStarChallenges: s.improvedStarChallengeIds.length,
    dailyWins: s.dailyWins,
    dailyBestStreak: s.longestDailyChallengeStreak,
    podium: s.dailyPodium ?? { ...EMPTY_PODIUM },
    onfSolved: s.onfSolvedCount,
    onfPerfect: s.onfPerfectCount,
    onfExpress: s.onfSpeedCount,
    duelWins: s.friendWins,
    friendsChallenged: s.challengedFriendCount,
    cards: s.collectedCardCount,
    loyaltyBest: Math.max(s.loyaltyBest, s.loyaltyStreak),
    onfTotal,
  };
}
