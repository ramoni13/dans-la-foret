// ============================================================
// MOTEUR D'ÉVALUATION DES BADGES
// Fonction pure, idempotente, O(n) sur le catalogue.
// ============================================================

import { BonusId } from '../../constants/bonus';
import { BADGE_DEFINITIONS, BADGE_MAP, isInSeason } from '../../constants/badges';

/** Nombre de victoires sous seuil requis pour débloquer un badge vitesse */
export const SPEED_BADGE_TARGET = 5;

// ── Contexte de jeu transmis à l'évaluateur ───────────────────────────────────
export interface GameContext {
  challengeId: string;
  levelId: string;              // ex: "niveau_3"
  levelNumber: number;          // ex: 3
  challengeNumber: number;      // numéro du défi dans le niveau (1–10)
  elapsedMs: number;            // durée de la partie en ms
  estimatedDurationMs: number;  // durée estimée du défi en ms (challenge.estimatedDuration * 1000)
  bonusUsed: BonusId[];         // bonus activés pendant la partie
  /** Nombre de fois où le joueur a appuyé sur Valider et s'est trompé pendant cette partie.
   *  0 = défi terminé du premier coup. C'est ce qui conditionne noErrorStreak. */
  failCount: number;
  noErrorStreak: number;        // défis CONSÉCUTIFS sans erreur APRÈS mise à jour du store (pour métriques globales)
  dailyStreak: number;          // jours consécutifs joués (APRÈS mise à jour du jour courant)
  earnedBadges: string[];       // badges déjà obtenus — pour idempotence (AVANT cette partie)
  completedChallenges: string[]; // tous les défis déjà validés AVANT ajout du défi courant
  completedLevels: string[];    // niveaux entièrement complétés (tous leurs 10 défis)
  friendWins: number;           // victoires cumulées contre amis
  bestTimes: Record<string, number>; // challengeId → meilleur temps ms (AVANT mise à jour)
  totalFriendsInvited: number;
  topDEJCount: number;          // fois dans le top 3 du défi du jour
  playedAt: Date;               // horodatage de la fin de partie
  sameChallengePlays: Record<string, number>; // challengeId → nb de fois joué (AVANT cette partie)
  seasonalChallengesPlayed: number; // défis joués pendant la saison en cours (cumulé)
  isWorldRecord: boolean;   // true = on vient de battre le record mondial (ancien WR existait)
  isFirstRecord: boolean;   // true = on est le premier à enregistrer un temps sur ce défi
  /** Nb de défis distincts dont le meilleur temps a été amélioré (post-update) */
  improvedChallengesCount?: number;
  /** Objectifs badge actifs du joueur — seuls ces badges (éligibles) peuvent être décernés */
  activeBadgeGoals?: string[];
  /**
   * Compteurs dédiés par badge objectif actif (post-update : markChallengeCompleted vient
   * de les incrémenter). Chaque compteur part de 0 à l'activation et compte uniquement
   * les défis où la condition propre au badge a été satisfaite.
   * Utilisé pour vitesse_* et precision_* — les badges à condition par défi.
   */
  goalCounters?: Record<string, number>;
  /**
   * Compteurs de victoires sous seuil vitesse par badge (post-update).
   * Conservé pour compatibilité mais non utilisé pour les badges en objectif actif
   * (goalCounters prend le relais). Utilisé pour les badges vitesse hors objectif actif.
   */
  speedBadgeHits?: Record<string, number>;
}

// ── Fonctions utilitaires internes ────────────────────────────────────────────

/** Retourne les IDs de défis du niveau donné qui sont dans completedChallenges */
function completedInLevel(levelId: string, completed: string[]): string[] {
  return completed.filter(id => id.startsWith(levelId + '_'));
}

/**
 * Vérifie si le meilleur temps sur challengeId a été amélioré cette partie.
 * "Amélioré" = on avait déjà un temps ET elapsedMs < ancien bestTime.
 */
function isPersonalBest(ctx: GameContext): boolean {
  const prev = ctx.bestTimes[ctx.challengeId];
  return prev !== undefined && ctx.elapsedMs < prev;
}

// ── Évaluateur principal ───────────────────────────────────────────────────────

/**
 * Retourne les IDs des badges nouvellement débloqués lors de cette partie.
 * Idempotent : les badges déjà dans earnedBadges ne sont jamais retournés.
 *
 * Règle d'activation :
 * - Les badges éligibles (dans ELIGIBLE_GOAL_BADGE_IDS) ne peuvent être décernés
 *   que s'ils sont dans ctx.activeBadgeGoals. C'est le système "objectif actif requis".
 * - Les badges secrets, saisonniers, records et daily sont toujours décernables
 *   (pas d'activation requise — conditions hors contrôle du joueur).
 *
 * @param ctx Contexte de la partie terminée (doit inclure activeBadgeGoals)
 * @returns Liste des badgeId à décerner (peut être vide)
 */
export function evaluateBadges(ctx: GameContext): string[] {
  const earned = new Set(ctx.earnedBadges);
  const newBadges: string[] = [];
  // Set des objectifs actifs pour lookup O(1)
  const activeGoals   = new Set(ctx.activeBadgeGoals ?? []);
  // Set des éligibles pour savoir si un badge nécessite une activation
  const eligibleSet   = new Set(ELIGIBLE_GOAL_BADGE_IDS);

  function award(badgeId: string) {
    if (earned.has(badgeId)) return;
    // Si ce badge est éligible (activable), il ne peut être décerné que s'il est actif
    if (eligibleSet.has(badgeId) && !activeGoals.has(badgeId)) return;
    earned.add(badgeId);
    newBadges.push(badgeId);
  }

  // Pré-calculs
  const elapsedSec      = ctx.elapsedMs / 1000;
  const estimatedSec    = ctx.estimatedDurationMs / 1000;
  const ratio           = estimatedSec > 0 ? ctx.elapsedMs / ctx.estimatedDurationMs : 1;
  const completedBefore = ctx.completedChallenges;
  const completedLevels = ctx.completedLevels;
  const hour            = ctx.playedAt.getHours();
  const minute          = ctx.playedAt.getMinutes();
  const dayOfWeek       = ctx.playedAt.getDay(); // 0=Dim
  const monthDay        = ctx.playedAt.getMonth() + 1;
  const dateDay         = ctx.playedAt.getDate();
  const goalCounters    = ctx.goalCounters ?? {};

  // ── VITESSE ─────────────────────────────────────────────────────────────────
  // Pour les badges en objectif actif : goalCounters[badgeId] compte les défis sous seuil
  // depuis l'activation (repart de 0 à chaque activation). Cible = SPEED_BADGE_TARGET (5).
  // Pour les badges hors objectif : speedBadgeHits (compteur global, non utilisé ici car
  // award() bloque les badges éligibles non actifs).
  //
  //   Badge          | Niv 1 | +/niv | Niv 5 | Niv 10 | Niv 13
  //   vitesse_tortue |  30 s |   +5  |  50 s |   75 s |   90 s
  //   vitesse_loup   |  20 s |   +3  |  32 s |   47 s |   56 s
  //   vitesse_oiseau |  12 s |   +2  |  20 s |   30 s |   36 s
  //   vitesse_eclair |   7 s |   +1  |  11 s |   16 s |   19 s
  //   vitesse_tornade|   4 s |  +0.5 |   6 s |    8 s |   10 s
  if ((goalCounters['vitesse_tortue']  ?? 0) >= SPEED_BADGE_TARGET) award('vitesse_tortue');
  if ((goalCounters['vitesse_Loup']    ?? 0) >= SPEED_BADGE_TARGET) award('vitesse_Loup');
  if ((goalCounters['vitesse_oiseau']  ?? 0) >= SPEED_BADGE_TARGET) award('vitesse_oiseau');
  if ((goalCounters['vitesse_eclair']  ?? 0) >= SPEED_BADGE_TARGET) award('vitesse_eclair');
  if ((goalCounters['vitesse_tornade'] ?? 0) >= SPEED_BADGE_TARGET) award('vitesse_tornade');

  // ── PRÉCISION ────────────────────────────────────────────────────────────────
  // goalCounters[badgeId] compte les défis consécutifs sans erreur depuis l'activation.
  // Remis à 0 si errorCount > 0 (dans markChallengeCompleted) ou à l'activation.
  // Cibles : pousse=3, oeil=3, hibou=10, arc=25, couronne=50.
  if ((goalCounters['precision_pousse']   ?? 0) >= 3)  award('precision_pousse');
  if ((goalCounters['precision_oeil']     ?? 0) >= 3)  award('precision_oeil');
  if ((goalCounters['precision_hibou']    ?? 0) >= 10) award('precision_hibou');
  if ((goalCounters['precision_arc']      ?? 0) >= 25) award('precision_arc');
  if ((goalCounters['precision_couronne'] ?? 0) >= 50) award('precision_couronne');

  // ── RÉGULARITÉ ───────────────────────────────────────────────────────────────
  // dailyStreak est une métrique monotone croissante (ou reset sur rupture) —
  // pas de problème d'activation tardive car chaque badge a un seuil distinct.
  if (ctx.dailyStreak >= 3)   award('regularite_aube');
  if (ctx.dailyStreak >= 7)   award('regularite_fougere');
  if (ctx.dailyStreak >= 30)  award('regularite_arbre');
  if (ctx.dailyStreak >= 100) award('regularite_foret');

  // Veilleur de lune : joue entre 22h et 6h + dailyStreak >= 3 nuits consécutives
  if ((hour >= 22 || hour < 6) && ctx.dailyStreak >= 3) {
    award('regularite_lune');
  }

  // Lève-tôt : joue entre 6h et 9h + dailyStreak >= 5 matins consécutifs
  if (hour >= 6 && hour < 9 && ctx.dailyStreak >= 5) {
    award('regularite_soleil');
  }

  // ── SOCIAL ───────────────────────────────────────────────────────────────────
  if (ctx.totalFriendsInvited >= 1) award('social_poignee');
  if (ctx.friendWins >= 5)          award('social_lion');
  if (ctx.friendWins >= 20)         award('social_loup');
  if (ctx.friendWins >= 50)         award('social_roi');
  if (ctx.totalFriendsInvited >= 5) award('social_cirque');
  if (ctx.topDEJCount >= 5)         award('social_trophee');

  // ── AMÉLIORATION ─────────────────────────────────────────────────────────────
  if ((ctx.improvedChallengesCount ?? 0) >= 3)  award('amelioration_graphe');

  // "Persévérant" : a rejoué le même défi >= 3 fois (sameChallengePlays est AVANT cette partie)
  const playsOnThisChallenge = (ctx.sameChallengePlays[ctx.challengeId] ?? 0) + 1;
  if (playsOnThisChallenge >= 3) award('amelioration_cycle');

  // "Perfection absolue" : terminé en < 20% du temps estimé ET sans aucun échec
  if (ratio < 0.20 && ctx.failCount === 0) {
    award('amelioration_etoile');
  }

  // "Fusée" : 10 défis distincts dont le temps a été amélioré (record personnel battu)
  if ((ctx.improvedChallengesCount ?? 0) >= 10) award('amelioration_fusee');

  // ── EXPLORATION ──────────────────────────────────────────────────────────────
  if (['niveau_1', 'niveau_2', 'niveau_3'].every(n => completedLevels.includes(n))) {
    award('exploration_graine');
  }
  if (['niveau_1', 'niveau_2', 'niveau_3', 'niveau_4', 'niveau_5'].every(n => completedLevels.includes(n))) {
    award('exploration_herbe');
  }
  const n1_9 = ['niveau_1','niveau_2','niveau_3','niveau_4','niveau_5',
                 'niveau_6','niveau_7','niveau_8','niveau_9'];
  if (n1_9.every(n => completedLevels.includes(n))) {
    award('exploration_chene');
  }
  const allLevels = [...n1_9, 'niveau_10','niveau_11','niveau_12','niveau_13'];
  if (allLevels.every(n => completedLevels.includes(n))) {
    award('exploration_crane');
  }

  // "Sans bonus" : complète le dernier défi d'un niveau (n°10) sans bonus
  if (ctx.bonusUsed.length === 0 && ctx.challengeNumber === 10) {
    const levelDone = completedInLevel(ctx.levelId, completedBefore).length >= 9;
    if (levelDone) {
      award('exploration_cible');
    }
  }

  // "Collectionneur" : 50 défis complétés (APRÈS ajout du défi courant)
  const totalDone = completedBefore.length + 1;
  if (totalDone >= 50) award('exploration_collectionneur');

  // ── SECRETS ──────────────────────────────────────────────────────────────────

  // "Le Fantôme" : minuit exact (heure = 0 et minute = 0)
  if (hour === 0 && minute === 0) {
    award('secret_fantome');
  }

  // "Noël en forêt" : 25 décembre
  if (monthDay === 12 && dateDay === 25) {
    award('secret_noel');
  }

  // "L'Oeuf de Pâques" : dimanche entre 7h et 9h
  if (dayOfWeek === 0 && hour >= 7 && hour < 9) {
    award('secret_paques');
  }

  // "Déjà-vu" : rejoue le même défi 10 fois (sameChallengePlays est avant cette partie)
  if (playsOnThisChallenge >= 10) {
    award('secret_boucle');
  }

  // "Acharnement" : a échoué >= 5 fois avant de réussir
  if (ctx.failCount >= 5) {
    award('secret_coeur_brise');
  }

  // ── SAISONNIERS ──────────────────────────────────────────────────────────────
  // Déclenchés uniquement quand le joueur atteint 5 défis dans la saison.
  // seasonalChallengesPlayed est le compteur mis à jour AVANT cette évaluation.
  for (const badge of BADGE_DEFINITIONS) {
    if (badge.isSeasonal && isInSeason(badge, ctx.playedAt)) {
      // Le badge saisonnier nécessite d'avoir joué 5 défis pendant la saison
      if (ctx.seasonalChallengesPlayed >= 5) {
        award(badge.id);
      }
    }
  }

  // ── RECORDS MONDIAUX ─────────────────────────────────────────────────────────
  // isFirstRecord : vrai si aucun joueur n'avait encore de temps sur ce défi
  // isWorldRecord  : vrai si on vient de battre un record existant
  if (ctx.isFirstRecord) {
    award('record_first');
  }
  if (ctx.isWorldRecord) {
    award('record_mondial');
    // Battre un record existant inclut aussi le premier record (mais record_first
    // s'applique exclusivement aux premières fois, donc pas de doublon ici)
  }

  return newBadges;
}

// ── Contexte spécifique au défi journalier ────────────────────────────────────

export interface DailyGameContext {
  dailyChallengeStreak: number;   // Jours consécutifs de défis journaliers réussis (APRÈS mise à jour)
  rank: number;                    // Classement du joueur dans le leaderboard journalier (1 = premier)
  earnedBadges: string[];          // Badges déjà obtenus (AVANT cette partie)
}

/**
 * Évalue les badges liés au défi journalier.
 * Appelé après une victoire sur le défi journalier.
 *
 * @param ctx Contexte du défi journalier terminé
 * @returns Liste des badgeId à décerner (peut être vide)
 */
export function evaluateDailyBadges(ctx: DailyGameContext): string[] {
  const earned = new Set(ctx.earnedBadges);
  const newBadges: string[] = [];

  function award(badgeId: string) {
    if (!earned.has(badgeId)) {
      earned.add(badgeId);
      newBadges.push(badgeId);
    }
  }

  // Premier défi journalier réussi (streak >= 1)
  if (ctx.dailyChallengeStreak >= 1) {
    award('daily_first');
  }

  // 7 jours consécutifs
  if (ctx.dailyChallengeStreak >= 7) {
    award('daily_week');
  }

  // 30 jours consécutifs
  if (ctx.dailyChallengeStreak >= 30) {
    award('daily_month');
  }

  // #1 mondial
  if (ctx.rank === 1) {
    award('daily_champion');
  }

  return newBadges;
}

// ── IDs des badges éligibles comme objectifs actifs ──────────────────────────
// Tous les badges sauf : secrets (isSecret), saisonniers (isSeasonal), records mondiaux.
// Ces exclusions n'ont pas de progression numérique régulière ou sont hors de contrôle
// du joueur (condition temporelle, record mondial).
//
// Ordre d'affichage dans BadgeGoalPickerModal : du plus facile au plus difficile.
export const ELIGIBLE_GOAL_BADGE_IDS: string[] = [
  // ── Vitesse (5) ── du plus accessible au plus exigeant
  'vitesse_tortue', 'vitesse_Loup', 'vitesse_oiseau', 'vitesse_eclair', 'vitesse_tornade',
  // ── Précision (5) ── streak consécutif sans erreur
  'precision_pousse', 'precision_oeil', 'precision_hibou', 'precision_arc', 'precision_couronne',
  // ── Régularité (4) ── streak journalier (heure de jeu exclue : condition non mesurable)
  'regularite_aube', 'regularite_fougere', 'regularite_arbre', 'regularite_foret',
  // ── Amélioration (4) ── record perso, rejouer, perfection, 10 améliorés
  'amelioration_graphe', 'amelioration_cycle', 'amelioration_etoile', 'amelioration_fusee',
  // ── Exploration (6) ── niveaux complétés, sans bonus, 50 défis
  'exploration_graine', 'exploration_herbe', 'exploration_chene', 'exploration_crane',
  'exploration_cible', 'exploration_collectionneur',
  // ── Social (5) ── victoires amis, invitations, top DEJ
  'social_poignee', 'social_lion', 'social_loup', 'social_roi', 'social_cirque', 'social_trophee',
  // ── Défi journalier (4) ── streak daily
  'daily_first', 'daily_week', 'daily_month', 'daily_champion',
];

// ── 3 badges proposés par défaut à un nouveau joueur ─────────────────────────
// Faciles, atteignables dès les premières parties.
export const DEFAULT_BADGE_GOALS: string[] = [
  'vitesse_tortue',    // Finir un défi en moins de 30s (niv 1) — très accessible
  'precision_pousse',  // Valider du premier coup — 1 défi suffît
  'regularite_aube',   // Jouer 3 jours de suite — motivation quotidienne
];

// ── Calcul de la progression vers les badges non encore obtenus ───────────────

export interface BadgeProgress {
  badgeId: string;
  currentValue: number;
  targetValue: number;
  percentage: number; // 0–1
  /** Unité d'affichage pour current/target. 'seconds' → formatté en "Xm Ys", 'count' → nombre brut */
  unit?: 'seconds' | 'count';
}

/**
 * Retourne les 5 badges les plus proches d'être débloqués,
 * triés par pourcentage de progression décroissant.
 * Utilisé pour l'affichage dans la VictoryModal.
 */
export function getClosestBadges(ctx: GameContext): BadgeProgress[] {
  const earned = new Set(ctx.earnedBadges);
  const result: BadgeProgress[] = [];

  const totalDone  = ctx.completedChallenges.length;

  // ── Badges vitesse : progression par comptage (X/5 victoires sous seuil) ────
  const speedHits = ctx.speedBadgeHits ?? {};
  const speedBadgeIds = ['vitesse_tortue', 'vitesse_Loup', 'vitesse_oiseau', 'vitesse_eclair', 'vitesse_tornade'];
  for (const badgeId of speedBadgeIds) {
    if (earned.has(badgeId)) continue;
    if (!BADGE_MAP[badgeId]) continue;
    const current = Math.min(speedHits[badgeId] ?? 0, SPEED_BADGE_TARGET);
    result.push({
      badgeId,
      currentValue: current,
      targetValue:  SPEED_BADGE_TARGET,
      percentage:   current / SPEED_BADGE_TARGET,
      unit:         'count',
    });
  }

  // ── Compteurs exploration basés sur les niveaux complétés ────────────────────
  const levelsCompleted = ctx.completedLevels ?? [];
  const niv3done  = ['niveau_1','niveau_2','niveau_3'].filter(n => levelsCompleted.includes(n)).length;
  const niv5done  = ['niveau_1','niveau_2','niveau_3','niveau_4','niveau_5'].filter(n => levelsCompleted.includes(n)).length;
  const niv9done  = ['niveau_1','niveau_2','niveau_3','niveau_4','niveau_5',
                     'niveau_6','niveau_7','niveau_8','niveau_9'].filter(n => levelsCompleted.includes(n)).length;
  const niv13done = [...['niveau_1','niveau_2','niveau_3','niveau_4','niveau_5',
                     'niveau_6','niveau_7','niveau_8','niveau_9'],
                     'niveau_10','niveau_11','niveau_12','niveau_13'].filter(n => levelsCompleted.includes(n)).length;

  // ── Autres badges : current/target linéaires ──────────────────────────────────
  const progressMap: Record<string, [number, number]> = {
    // Précision (noErrorStreak : défis consécutifs sans erreur)
    // failCount === -1 = hors partie (profil) → afficher la valeur actuelle du streak
    // failCount > 0 = partie avec erreurs → streak sera 0 après reset (on affiche 0)
    precision_pousse:          [ctx.failCount <= 0 ? ctx.noErrorStreak : 0, 3],
    precision_oeil:            [ctx.failCount <= 0 ? ctx.noErrorStreak : 0, 3],
    precision_hibou:           [ctx.noErrorStreak, 10],
    precision_arc:             [ctx.noErrorStreak, 25],
    precision_couronne:        [ctx.noErrorStreak, 50],
    // Régularité
    regularite_aube:           [ctx.dailyStreak, 3],
    regularite_fougere:        [ctx.dailyStreak, 7],
    regularite_arbre:          [ctx.dailyStreak, 30],
    regularite_foret:          [ctx.dailyStreak, 100],
    // Social
    social_poignee:            [ctx.totalFriendsInvited >= 1 ? 1 : 0, 1],
    social_lion:               [ctx.friendWins, 5],
    social_loup:               [ctx.friendWins, 20],
    social_roi:                [ctx.friendWins, 50],
    social_cirque:             [ctx.totalFriendsInvited, 5],
    social_trophee:            [ctx.topDEJCount, 5],
    // Amélioration
    amelioration_graphe:       [ctx.improvedChallengesCount ?? 0, 3],
    amelioration_cycle:        [Math.min(ctx.sameChallengePlays?.[ctx.challengeId] ?? 0, 3), 3],
    amelioration_etoile:       [(ctx.failCount === 0 && ctx.estimatedDurationMs > 0 && ctx.elapsedMs / ctx.estimatedDurationMs < 0.20) ? 1 : 0, 1],
    amelioration_fusee:        [ctx.improvedChallengesCount ?? 0, 10],
    // Exploration (niveaux)
    exploration_graine:        [niv3done,  3],
    exploration_herbe:         [niv5done,  5],
    exploration_chene:         [niv9done,  9],
    exploration_crane:         [niv13done, 13],
    exploration_cible:         [(ctx.bonusUsed?.length === 0 && ctx.challengeNumber === 10) ? 1 : 0, 1],
    exploration_collectionneur:[totalDone, 50],
  };

  for (const [badgeId, [current, target]] of Object.entries(progressMap)) {
    if (earned.has(badgeId)) continue;
    if (!BADGE_MAP[badgeId]) continue;
    const clamped = Math.min(current, target);
    result.push({
      badgeId,
      currentValue: Math.round(clamped),
      targetValue:  Math.round(target),
      percentage:   target > 0 ? clamped / target : 0,
    });
  }

  return result
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);
}

/**
 * Retourne la progression d'un badge spécifique depuis le contexte de jeu.
 * Pour vitesse_* et precision_*, utilise goalCounters (compteur dédié depuis activation).
 * Pour les autres badges, utilise les métriques globales directement.
 *
 * @param badgeId  ID du badge à calculer
 * @param ctx      Contexte de jeu courant (doit inclure goalCounters pour vitesse/précision)
 */
export function getBadgeProgress(badgeId: string, ctx: GameContext): BadgeProgress | null {
  const earned = new Set(ctx.earnedBadges);
  if (earned.has(badgeId)) return null; // déjà obtenu

  const goalCounters2 = ctx.goalCounters ?? {};
  const totalDone = ctx.completedChallenges.length;

  // Vitesse : goalCounters[badgeId] = nb de défis sous seuil depuis activation
  const speedBadgeIdsSet = new Set(['vitesse_tortue', 'vitesse_Loup', 'vitesse_oiseau', 'vitesse_eclair', 'vitesse_tornade']);
  if (speedBadgeIdsSet.has(badgeId)) {
    const current = Math.min(goalCounters2[badgeId] ?? 0, SPEED_BADGE_TARGET);
    return { badgeId, currentValue: current, targetValue: SPEED_BADGE_TARGET, percentage: current / SPEED_BADGE_TARGET, unit: 'count' };
  }

  // Précision : goalCounters[badgeId] = nb de défis consécutifs sans erreur depuis activation
  const precisionTargets: Record<string, number> = {
    precision_pousse: 3, precision_oeil: 3, precision_hibou: 10,
    precision_arc: 25, precision_couronne: 50,
  };
  if (precisionTargets[badgeId] !== undefined) {
    const target  = precisionTargets[badgeId];
    const current = Math.min(goalCounters2[badgeId] ?? 0, target);
    return { badgeId, currentValue: current, targetValue: target, percentage: target > 0 ? current / target : 0, unit: 'count' };
  }

  // Niveaux complétés pour l'exploration
  const levelsCompleted2 = ctx.completedLevels ?? [];
  const niv3done2  = ['niveau_1','niveau_2','niveau_3'].filter(n => levelsCompleted2.includes(n)).length;
  const niv5done2  = ['niveau_1','niveau_2','niveau_3','niveau_4','niveau_5'].filter(n => levelsCompleted2.includes(n)).length;
  const niv9done2  = ['niveau_1','niveau_2','niveau_3','niveau_4','niveau_5',
                      'niveau_6','niveau_7','niveau_8','niveau_9'].filter(n => levelsCompleted2.includes(n)).length;
  const niv13done2 = [...['niveau_1','niveau_2','niveau_3','niveau_4','niveau_5',
                      'niveau_6','niveau_7','niveau_8','niveau_9'],
                      'niveau_10','niveau_11','niveau_12','niveau_13'].filter(n => levelsCompleted2.includes(n)).length;

  // Autres badges : métriques globales directes
  const progressMap: Record<string, [number, number]> = {
    // Régularité
    regularite_aube:            [ctx.dailyStreak, 3],
    regularite_fougere:         [ctx.dailyStreak, 7],
    regularite_arbre:           [ctx.dailyStreak, 30],
    regularite_foret:           [ctx.dailyStreak, 100],
    // Social
    social_poignee:             [ctx.totalFriendsInvited >= 1 ? 1 : 0, 1],
    social_lion:                [ctx.friendWins, 5],
    social_loup:                [ctx.friendWins, 20],
    social_roi:                 [ctx.friendWins, 50],
    social_cirque:              [ctx.totalFriendsInvited, 5],
    social_trophee:             [ctx.topDEJCount, 5],
    // Amélioration
    amelioration_graphe:        [ctx.improvedChallengesCount ?? 0, 3],
    amelioration_cycle:         [Math.min((ctx.sameChallengePlays?.[ctx.challengeId] ?? 0) + 1, 3), 3],
    amelioration_etoile:        [(ctx.failCount === 0 && ctx.estimatedDurationMs > 0 && ctx.elapsedMs / ctx.estimatedDurationMs < 0.20) ? 1 : 0, 1],
    amelioration_fusee:         [ctx.improvedChallengesCount ?? 0, 10],
    // Exploration
    exploration_graine:         [niv3done2,  3],
    exploration_herbe:          [niv5done2,  5],
    exploration_chene:          [niv9done2,  9],
    exploration_crane:          [niv13done2, 13],
    exploration_cible:          [(ctx.bonusUsed?.length === 0 && ctx.challengeNumber === 10) ? 1 : 0, 1],
    exploration_collectionneur: [totalDone, 50],
  };

  if (progressMap[badgeId] !== undefined) {
    const [current, target] = progressMap[badgeId];
    const clamped = Math.min(current, target);
    return {
      badgeId,
      currentValue: Math.round(clamped),
      targetValue:  Math.round(target),
      percentage:   target > 0 ? clamped / target : 0,
    };
  }

  return null;
}

/**
 * Retourne la valeur courante brute de la métrique associée à un badge.
 * Utilisé pour capturer la valeur de départ quand un objectif est sélectionné.
 * Retourne 0 si le badge n'a pas de métrique mesurable (exploration sans ctx complet, etc.)
 */
export function getBadgeCurrentValue(badgeId: string, ctx: Partial<GameContext>): number {
  const speedBadgeIdsSet = new Set(['vitesse_tortue', 'vitesse_Loup', 'vitesse_oiseau', 'vitesse_eclair', 'vitesse_tornade']);
  if (speedBadgeIdsSet.has(badgeId)) {
    return (ctx.speedBadgeHits ?? {})[badgeId] ?? 0;
  }

  const totalDone = (ctx.completedChallenges ?? []).length;

  const valueMap: Record<string, number> = {
    precision_pousse:           ctx.noErrorStreak ?? 0, // streak consécutif sans erreur
    precision_oeil:             ctx.noErrorStreak ?? 0,
    precision_hibou:            ctx.noErrorStreak ?? 0,
    precision_arc:              ctx.noErrorStreak ?? 0,
    precision_couronne:         ctx.noErrorStreak ?? 0,
    regularite_aube:            ctx.dailyStreak ?? 0,
    regularite_fougere:         ctx.dailyStreak ?? 0,
    regularite_arbre:           ctx.dailyStreak ?? 0,
    regularite_foret:           ctx.dailyStreak ?? 0,
    social_poignee:             0, // binaire
    social_lion:                ctx.friendWins ?? 0,
    social_loup:                ctx.friendWins ?? 0,
    social_roi:                 ctx.friendWins ?? 0,
    social_cirque:              ctx.totalFriendsInvited ?? 0,
    social_trophee:             ctx.topDEJCount ?? 0,
    amelioration_graphe:        ctx.improvedChallengesCount ?? 0,
    amelioration_cycle:         0, // sameChallengePlays non accessible ici simplement
    amelioration_etoile:        0, // binaire
    amelioration_fusee:         ctx.improvedChallengesCount ?? 0,
    exploration_graine:         0, // niveau-based, difficile à capturer ici
    exploration_herbe:          0,
    exploration_chene:          0,
    exploration_crane:          0,
    exploration_cible:          0,
    exploration_collectionneur: totalDone,
    daily_first:                0,
    daily_week:                 0,
    daily_month:                0,
    daily_champion:             0,
  };

  return valueMap[badgeId] ?? 0;
}

// Séquences ordonnées par catégorie (du plus accessible au plus difficile).
// pickNextAutoGoal parcourt ces listes dans l'ordre et retourne le premier
// badge non obtenu et non déjà en objectif actif.
const GOAL_SEQUENCES: Record<string, string[]> = {
  vitesse:      ['vitesse_tortue', 'vitesse_Loup', 'vitesse_oiseau', 'vitesse_eclair', 'vitesse_tornade'],
  precision:    ['precision_pousse', 'precision_oeil', 'precision_hibou', 'precision_arc', 'precision_couronne'],
  regularite:   ['regularite_aube', 'regularite_fougere', 'regularite_arbre', 'regularite_foret'],
  amelioration: ['amelioration_graphe', 'amelioration_cycle', 'amelioration_etoile', 'amelioration_fusee'],
  exploration:  ['exploration_graine', 'exploration_herbe', 'exploration_chene', 'exploration_crane', 'exploration_cible', 'exploration_collectionneur'],
  social:       ['social_poignee', 'social_lion', 'social_loup', 'social_roi', 'social_cirque', 'social_trophee'],
  daily:        ['daily_first', 'daily_week', 'daily_month', 'daily_champion'],
};

// Ordre de fallback entre catégories quand la catégorie du badge complété est épuisée
const CATEGORY_ORDER = ['vitesse', 'precision', 'regularite', 'amelioration', 'exploration', 'social', 'daily'];

/**
 * Sélectionne automatiquement le prochain badge objectif pour remplacer un slot libéré.
 *
 * Stratégie :
 * 1. Dans la même catégorie que le badge complété, prend le badge suivant dans la séquence.
 * 2. Si la catégorie est épuisée, cherche dans les autres catégories dans CATEGORY_ORDER.
 * 3. Retourne null si aucun badge disponible.
 *
 * @param completedBadgeId  ID du badge qui vient d'être obtenu
 * @param earnedBadges      Badges déjà obtenus (incluant le badge complété)
 * @param currentGoals      Objectifs actifs actuels (après retrait du badge complété)
 * @returns ID du prochain badge à ajouter, ou null
 */
export function pickNextAutoGoal(
  completedBadgeId: string,
  earnedBadges: string[],
  currentGoals: string[],
): string | null {
  const earnedSet = new Set(earnedBadges);
  const goalSet   = new Set(currentGoals);

  const isAvailable = (id: string) => !earnedSet.has(id) && !goalSet.has(id);

  const completedDef     = BADGE_MAP[completedBadgeId];
  const completedCategory = completedDef?.category ?? null;

  // 1. Même catégorie en priorité : premier badge disponible dans la séquence ordonnée
  if (completedCategory && GOAL_SEQUENCES[completedCategory]) {
    const next = GOAL_SEQUENCES[completedCategory].find(isAvailable);
    if (next) return next;
  }

  // 2. Autres catégories dans l'ordre de CATEGORY_ORDER
  for (const cat of CATEGORY_ORDER) {
    if (cat === completedCategory) continue; // déjà épuisée
    const next = (GOAL_SEQUENCES[cat] ?? []).find(isAvailable);
    if (next) return next;
  }

  return null;
}
