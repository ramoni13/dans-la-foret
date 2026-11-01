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
  /**
   * Nb de fois qu'un élément DÉJÀ POSÉ a été déplacé, retiré ou remplacé pendant cette partie.
   * 0 = la partie a été jouée sans aucune modification d'un jeton posé.
   * Utilisé pour le badge precision_parfaite.
   */
  elementChangeCount?: number;
  /**
   * Nb de victoires consécutives sur le défi verrouillé pour amelioration_cycle (post-update).
   * 0 si l'objectif n'est pas actif ou si le challengeId ne correspond pas au défi cible.
   */
  retryStreakCount?: number;
  /**
   * Nb de victoires consécutives sur le défi verrouillé pour amelioration_fusee (post-update).
   */
  retryStreakFuseeCount?: number;
  /** Nb d'abandons cumulés pour ce défi (pour badge precision_parfaite) */
  abandonCountForChallenge?: number;
  /** Compteurs ONF et daily — optionnels, utilisés dans getClosestBadges/getBadgeProgress */
  onfSolvedCount?: number;
  onfPerfectCount?: number;
  onfSpeedCount?: number;
  dailyPerfectCount?: number;
  dailySpeedCount?: number;
  /** Nb total de défis journaliers complétés avec succès (player.stats.dailyWon) */
  dailyCompleted?: number;
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
  if ((goalCounters['vitesse_loup']    ?? 0) >= SPEED_BADGE_TARGET) award('vitesse_loup');
  if ((goalCounters['vitesse_oiseau']  ?? 0) >= SPEED_BADGE_TARGET) award('vitesse_oiseau');
  if ((goalCounters['vitesse_eclair']  ?? 0) >= SPEED_BADGE_TARGET) award('vitesse_eclair');
  if ((goalCounters['vitesse_tornade'] ?? 0) >= SPEED_BADGE_TARGET) award('vitesse_tornade');

  // ── PRÉCISION ────────────────────────────────────────────────────────────────
  // goalCounters[badgeId] compte les défis consécutifs sans erreur depuis l'activation.
  // Remis à 0 si errorCount > 0 (dans markChallengeCompleted) ou à l'activation.
  // Cibles : pousse=3, oeil=3, hibou=10, arc=25, couronne=50.
  if ((goalCounters['precision_pousse']   ?? 0) >= 3)  award('precision_pousse');
  if ((goalCounters['precision_oeil']     ?? 0) >= 5)  award('precision_oeil');
  if ((goalCounters['precision_hibou']    ?? 0) >= 10) award('precision_hibou');
  if ((goalCounters['precision_arc']      ?? 0) >= 25) award('precision_arc');
  if ((goalCounters['precision_couronne'] ?? 0) >= 50) award('precision_couronne');
  if ((goalCounters['precision_parfaite'] ?? 0) >= 3)  award('precision_parfaite');

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
  // Badges amis (refonte)
  if (ctx.totalFriendsInvited >= 1)   award('ami_challenger');
  if (ctx.friendWins >= 100)          award('ami_serial');

  // ── AMÉLIORATION ─────────────────────────────────────────────────────────────
  if ((ctx.improvedChallengesCount ?? 0) >= 3)  award('amelioration_graphe');

  // "Persévérant" : 3 victoires sur le défi verrouillé à l'activation (retryStreakCount post-update)
  if ((ctx.retryStreakCount ?? 0) >= 3) award('amelioration_cycle');

  // "Perfection absolue" : terminé en < 20% du temps estimé ET sans aucun échec
  if (ratio < 0.20 && ctx.failCount === 0) {
    award('amelioration_etoile');
  }

  // "Discipline" : 5 défis distincts dont le temps a été amélioré
  if ((ctx.improvedChallengesCount ?? 0) >= 5) award('amelioration_discipline');

  // "Sur orbite" : 5 victoires sur le défi verrouillé à l'activation (retryStreakFuseeCount post-update)
  if ((ctx.retryStreakFuseeCount ?? 0) >= 5) award('amelioration_fusee');

  // "Marathon" : 20 victoires sous seuil vitesse_tortue (speedBadgeHits)
  if ((ctx.speedBadgeHits?.['vitesse_tortue'] ?? 0) >= 20) award('vitesse_marathon');

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
  const playsOnThisChallenge = (ctx.sameChallengePlays[ctx.challengeId] ?? 0) + 1;
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
  dailyChallengeStreak: number;    // Jours consécutifs de défis journaliers réussis (APRÈS mise à jour)
  rank: number;                    // Classement du joueur dans le leaderboard journalier (1 = premier)
  earnedBadges: string[];          // Badges déjà obtenus (AVANT cette partie)
  failCount?: number;              // Nb d'erreurs de validation pendant la partie daily (0 = sans faute)
  elapsedMs?: number;              // Durée de la partie daily (ms)
  dailyPerfectCount?: number;      // APRÈS incrémentation
  dailySpeedCount?: number;        // APRÈS incrémentation
  activeBadgeGoals?: string[];
  goalCounters?: Record<string, number>;
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
  const activeGoals = new Set(ctx.activeBadgeGoals ?? []);
  const eligibleSet = new Set(ELIGIBLE_GOAL_BADGE_IDS);

  function award(badgeId: string) {
    if (earned.has(badgeId)) return;
    // Les badges éligibles nécessitent d'être en objectif actif
    if (eligibleSet.has(badgeId) && !activeGoals.has(badgeId)) return;
    earned.add(badgeId);
    newBadges.push(badgeId);
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

  // 10 daily sans erreur
  if ((ctx.dailyPerfectCount ?? 0) >= 10) {
    award('daily_perfect');
  }

  // 3 daily en < 3 minutes (180s)
  if ((ctx.dailySpeedCount ?? 0) >= 3) {
    award('daily_speed');
  }

  return newBadges;
}

// ── Contexte spécifique au mode ONF ──────────────────────────────────────────

export interface OnfGameContext {
  onfSolvedCount: number;   // APRÈS incrémentation
  onfPerfectCount: number;  // APRÈS incrémentation (failCount=0)
  onfSpeedCount: number;    // APRÈS incrémentation (< 120s)
  earnedBadges: string[];
  activeBadgeGoals: string[];
  goalCounters: Record<string, number>;
}

/**
 * Évalue les badges liés au mode ONF.
 * Appelé après une victoire ONF.
 */
export function evaluateOnfBadges(ctx: OnfGameContext): string[] {
  const earned = new Set(ctx.earnedBadges);
  const newBadges: string[] = [];
  const activeGoals = new Set(ctx.activeBadgeGoals);
  const eligibleSet = new Set(ELIGIBLE_GOAL_BADGE_IDS);

  function award(badgeId: string) {
    if (earned.has(badgeId)) return;
    if (eligibleSet.has(badgeId) && !activeGoals.has(badgeId)) return;
    earned.add(badgeId);
    newBadges.push(badgeId);
  }

  // Badge unique immédiat — hors éligibles, pas de garde active goal
  if (ctx.onfSolvedCount >= 1 && !earned.has('onf_premier')) {
    earned.add('onf_premier');
    newBadges.push('onf_premier');
  }

  if (ctx.onfSolvedCount >= 10)  award('onf_forestier');
  if (ctx.onfSolvedCount >= 50)  award('onf_maitre');
  if (ctx.onfPerfectCount >= 3)  award('onf_precision');
  if (ctx.onfSpeedCount >= 3)    award('onf_speed');

  return newBadges;
}

// ── 3 Lignes de badges typées (Track system) ─────────────────────────────────

/** Ligne A — Performance : vitesse et précision, condition évaluée à chaque défi. */
export const TRACK_PERFORMANCE: string[] = [
  'precision_pousse',     // 3 défis sans erreur de validation       (bois)
  'vitesse_tortue',       // 5 défis en < seuil tortue               (bois)
  'precision_oeil',       // 5 défis consécutifs sans erreur         (pierre)
  'vitesse_loup',         // 5 défis < seuil loup                    (pierre)
  'precision_parfaite',   // 3 poses parfaites consécutives          (or)
  'vitesse_oiseau',       // 5 défis < seuil oiseau                  (or)
  'amelioration_etoile',  // terminer en < 20 % du temps estimé, 0 erreur (or)
  'precision_hibou',      // 10 défis consécutifs sans erreur        (or)
  'vitesse_eclair',       // 5 défis < seuil éclair                  (or)
  'precision_arc',        // 25 défis consécutifs sans erreur        (or)
  'vitesse_tornade',      // 5 défis < seuil tornade                 (cristal)
  'precision_couronne',   // 50 défis consécutifs sans erreur        (cristal)
];

/** Ligne B — Persévérance : régularité et accumulation dans le temps. */
export const TRACK_PERSEVERANCE: string[] = [
  'regularite_aube',          // 3 jours de connexion consécutifs        (bois)
  'daily_first',              // réussir le 1er défi journalier          (bois)
  'exploration_collectionneur', // 50 défis complétés                    (pierre)
  'regularite_fougere',       // 7 jours consécutifs                     (pierre)
  'daily_week',               // 7 daily consécutifs                     (pierre)
  'daily_speed',              // 3 daily en < 3 min                      (pierre)
  'vitesse_marathon',         // 20 victoires sous seuil tortue          (or)
  'regularite_arbre',         // 30 jours consécutifs                    (or)
  'daily_perfect',            // 10 daily sans erreur                    (or)
  'daily_month',              // 30 daily consécutifs                    (or)
  'regularite_foret',         // 100 jours consécutifs                   (cristal)
  'daily_champion',           // #1 mondial daily                        (cristal)
];

/** Ligne C — Exploration & Variété : modes, social, amélioration. */
export const TRACK_EXPLORATION: string[] = [
  'exploration_graine',       // niveaux 1-3 complétés                   (bois)
  'amelioration_cycle',       // rejouer 3× le même défi                 (bois)
  'exploration_herbe',        // niveaux 1-5                             (pierre)
  'onf_precision',            // 3 grilles ONF sans erreur               (pierre)
  'amelioration_graphe',      // 3 personal bests battus                 (bois, slot 5 pour fluidité)
  'onf_speed',                // 3 grilles ONF < 2 min                   (pierre)
  'amelioration_discipline',  // 5 défis distincts améliorés             (pierre)
  'exploration_chene',        // niveaux 1-9                             (or)
  'onf_forestier',            // 10 grilles ONF                          (or)
  'amelioration_fusee',       // 5× le même défi                         (pierre, slot 10)
  'exploration_cible',        // dernier défi d'un niveau sans bonus     (or)
  'onf_maitre',               // 50 grilles ONF                          (or)
  'exploration_crane',        // tous les 13 niveaux                     (cristal)
];

export type TrackName = 'performance' | 'perseverance' | 'exploration';

/** Toutes les tracks indexées par nom. */
export const TRACKS: Record<TrackName, string[]> = {
  performance:  TRACK_PERFORMANCE,
  perseverance: TRACK_PERSEVERANCE,
  exploration:  TRACK_EXPLORATION,
};

/** Retourne le nom de la track d'un badge, ou null si le badge est hors séquence. */
export function getTrackForBadge(badgeId: string): TrackName | null {
  if (TRACK_PERFORMANCE.includes(badgeId))  return 'performance';
  if (TRACK_PERSEVERANCE.includes(badgeId)) return 'perseverance';
  if (TRACK_EXPLORATION.includes(badgeId))  return 'exploration';
  return null;
}

/**
 * Prochain badge non obtenu dans la track, dont le prérequis est satisfait,
 * et différent du goal actuel.
 * Retourne null si la track est épuisée.
 */
export function pickNextTrackGoal(
  track: TrackName,
  earnedBadges: string[],
  currentGoal: string | null,
): string | null {
  const sequence = TRACKS[track];
  const earnedSet = new Set(earnedBadges);
  for (const id of sequence) {
    if (earnedSet.has(id)) continue;
    if (id === currentGoal) continue;
    if (!isBadgeEligibleAsGoal(id, earnedBadges)) continue;
    return id;
  }
  return null;
}

// ── Séquence maître et sélection automatique d'objectifs ─────────────────────

/**
 * Séquence maître unique — ordonnée du plus accessible au plus difficile,
 * en alternant les catégories pour maintenir la diversité des objectifs.
 * `pickNextAutoGoal` retourne le premier badge non obtenu et non déjà en objectif.
 *
 * Badges hors séquence (déclenchés automatiquement sans objectif actif) :
 *   secret_*, saisonnier_*, record_first, record_mondial, ami_de_la_foret,
 *   regularite_lune, regularite_soleil, onf_premier.
 */
export const MASTER_SEQUENCE: string[] = [
  // ── Phase 1 — Découverte (Bois) ──────────────────────────────────────────────
  'exploration_graine',      // Finir niv 1-3
  'regularite_aube',         // 3 jours de connexion
  'precision_pousse',        // 3 victoires sans erreur
  'vitesse_tortue',          // 5 victoires rapides
  'daily_first',             // Premier daily
  'amelioration_cycle',      // Rejouer 3× un défi
  'ami_challenger',          // Premier défi ami envoyé

  // ── Phase 2 — Progression (Pierre) ───────────────────────────────────────────
  'exploration_herbe',       // Niv 1-5
  'regularite_fougere',      // 7 jours
  'precision_oeil',          // 5 victoires consécutives sans erreur
  'vitesse_loup',            // 5 victoires < seuil loup
  'daily_week',              // 7 daily de suite
  'onf_precision',           // 3 grilles ONF sans erreur
  'social_poignee',          // Inviter 1 ami
  'amelioration_graphe',     // 3 PB battus
  'onf_speed',               // 3 grilles ONF < 2 min
  'daily_speed',             // 3 daily < 3 min
  'social_lion',             // 5 victoires ami
  'exploration_collectionneur', // 50 défis
  'amelioration_discipline', // 5 défis distincts améliorés
  'social_cirque',           // Inviter 5 amis

  // ── Phase 3 — Maîtrise (Or) ──────────────────────────────────────────────────
  'exploration_chene',       // Niv 1-9
  'precision_hibou',         // 10 victoires consécutives sans erreur
  'vitesse_oiseau',          // 5 victoires < seuil oiseau
  'precision_parfaite',      // 3 poses parfaites
  'daily_perfect',           // 10 daily sans erreur
  'onf_forestier',           // 10 grilles ONF
  'regularite_arbre',        // 30 jours
  'amelioration_etoile',     // Perfection absolue
  'amelioration_fusee',      // 10 PB distincts
  'social_loup',             // 20 victoires ami
  'daily_month',             // 30 daily de suite
  'exploration_cible',       // Dernier défi d'un niveau sans bonus
  'vitesse_marathon',        // 20 victoires sous seuil tortue
  'precision_arc',           // 25 victoires consécutives sans erreur
  'onf_maitre',              // 50 grilles ONF
  'social_roi',              // 50 victoires ami

  // ── Phase 4 — Légende (Cristal) ──────────────────────────────────────────────
  'exploration_crane',       // Tous les 13 niveaux
  'precision_couronne',      // 50 victoires consécutives sans erreur
  'vitesse_eclair',          // 5 victoires < 7s+1s/niv
  'regularite_foret',        // 100 jours
  'daily_champion',          // #1 mondial daily
  'vitesse_tornade',         // 5 victoires < 4s+0.5s/niv
  'social_trophee',          // Top 3 daily × 5
  'ami_serial',              // 100 victoires ami
];

// ── Prérequis inter-badges (chaînes de progression) ──────────────────────────
/**
 * Un badge ne peut devenir objectif actif (manuellement ou par auto-avance) que si
 * son prérequis est déjà dans earnedBadges.
 *
 * Chaînes couvertes :
 *   Précision consécutive : pousse → oeil → hibou → arc → couronne
 *   Vitesse               : tortue → loup → oiseau → eclair → tornade
 *   Régularité            : aube → fougere → arbre → foret
 *   Exploration           : graine → herbe → chene → collectionneur → crane
 *   Daily                 : first → week → perfect + speed → month → champion
 *   Social                : poignee → cirque (amis invités) ; lion → loup → roi (victoires)
 *   Amélioration          : graphe → discipline ; cycle → fusee → etoile
 *   ONF                   : precision → speed → forestier → maitre
 */
export const BADGE_PREREQUISITES: Record<string, string> = {
  // Précision consécutive
  precision_oeil:    'precision_pousse',
  precision_hibou:   'precision_oeil',
  precision_arc:     'precision_hibou',
  precision_couronne:'precision_arc',

  // Vitesse
  vitesse_loup:    'vitesse_tortue',
  vitesse_oiseau:  'vitesse_loup',
  vitesse_eclair:  'vitesse_oiseau',
  vitesse_tornade: 'vitesse_eclair',

  // Régularité (jours de connexion)
  regularite_fougere: 'regularite_aube',
  regularite_arbre:   'regularite_fougere',
  regularite_foret:   'regularite_arbre',

  // Exploration (niveaux)
  exploration_herbe:         'exploration_graine',
  exploration_chene:         'exploration_herbe',
  exploration_collectionneur:'exploration_chene',
  exploration_crane:         'exploration_collectionneur',

  // Daily
  daily_week:    'daily_first',
  daily_month:   'daily_week',
  daily_champion:'daily_month',

  // Social — amis invités
  social_cirque: 'social_poignee',
  // Social — victoires ami
  social_loup: 'social_lion',
  social_roi:  'social_loup',

  // Amélioration
  amelioration_discipline: 'amelioration_graphe',
  amelioration_fusee:      'amelioration_cycle',
  amelioration_etoile:     'amelioration_fusee',

  // ONF
  onf_speed:     'onf_precision',
  onf_forestier: 'onf_speed',
  onf_maitre:    'onf_forestier',
};

/**
 * Vérifie si un badge peut être mis en objectif actif, c'est-à-dire que son
 * prérequis (s'il en a un) est déjà dans la liste des badges obtenus.
 */
export function isBadgeEligibleAsGoal(badgeId: string, earnedBadges: string[]): boolean {
  const prereq = BADGE_PREREQUISITES[badgeId];
  if (!prereq) return true;               // pas de prérequis → toujours éligible
  return earnedBadges.includes(prereq);   // prérequis doit être obtenu
}

/**
 * Sélectionne automatiquement le prochain badge objectif pour remplacer un slot libéré.
 *
 * Stratégie : lit la MASTER_SEQUENCE dans l'ordre et retourne le premier badge
 * non encore obtenu, non déjà en objectif actif, et dont le prérequis est satisfait.
 *
 * @param completedBadgeId  ID du badge qui vient d'être obtenu (non utilisé, conservé pour compatibilité)
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
  return MASTER_SEQUENCE.find(
    id => !earnedSet.has(id) && !goalSet.has(id) && isBadgeEligibleAsGoal(id, earnedBadges),
  ) ?? null;
}

// ── IDs des badges éligibles comme objectifs actifs ──────────────────────────
// Dérivé des 3 tracks + MASTER_SEQUENCE.
// Les badges hors séquence (secret_*, saisonnier_*, regularite_lune/soleil,
// record_first/mondial, ami_de_la_foret, onf_premier) ne figurent PAS ici.
// exploration_graine est maintenant inclus car il est le premier objectif de
// la Track C — il n'est plus décernable sans objectif actif.
export const ELIGIBLE_GOAL_BADGE_IDS: string[] = Array.from(new Set([
  ...TRACK_PERFORMANCE,
  ...TRACK_PERSEVERANCE,
  ...TRACK_EXPLORATION,
  ...MASTER_SEQUENCE.filter(id => id !== 'onf_premier' && id !== 'exploration_graine'),
]));

// ── 3 badges proposés par défaut à un nouveau joueur ─────────────────────────
// Faciles, atteignables dès les premières parties (premiers de la MASTER_SEQUENCE).
export const DEFAULT_BADGE_GOALS: string[] = [
  'exploration_graine', // Finir les niveaux 1-3 — très accessible
  'precision_pousse',   // Valider du premier coup — 1 défi suffît
  'regularite_aube',    // Jouer 3 jours de suite — motivation quotidienne
];

// ── Calcul de la progression vers les badges non encore obtenus ───────────────

export interface BadgeProgress {
  badgeId: string;
  currentValue: number;
  targetValue: number;
  percentage: number; // 0–1
  /** Unité d'affichage pour current/target. 'seconds' → formatté en "Xm Ys", 'count' → nombre brut */
  unit?: 'seconds' | 'count';
  /**
   * Valeur avant la partie courante — fourni par [challengeId].tsx pour calculer le delta +N.
   * Absent si on ne connaît pas la valeur précédente (vue profil, compat descendante).
   */
  previousValue?: number;
  /**
   * Pour amelioration_cycle / amelioration_fusee : challengeId verrouillé à l'activation.
   * Affiché dans BadgeProgressInline sous la forme "Niveau X · Défi Y".
   */
  targetChallengeId?: string | null;
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
  const speedBadgeIds = ['vitesse_tortue', 'vitesse_loup', 'vitesse_oiseau', 'vitesse_eclair', 'vitesse_tornade'];
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
  // Pour la régularité : si le joueur a déjà joué, le minimum affiché est 1.
  const streakDisplay2 = ctx.dailyStreak > 0 ? ctx.dailyStreak
    : ((ctx.completedChallenges?.length ?? 0) > 0 ? 1 : 0);
  const progressMap: Record<string, [number, number]> = {
    // Précision (noErrorStreak : défis consécutifs sans erreur)
    // failCount === -1 = hors partie (profil) → afficher la valeur actuelle du streak
    // failCount > 0 = partie avec erreurs → streak sera 0 après reset (on affiche 0)
    precision_pousse:          [ctx.failCount <= 0 ? ctx.noErrorStreak : 0, 3],
    precision_oeil:            [ctx.failCount <= 0 ? ctx.noErrorStreak : 0, 5],
    precision_hibou:           [ctx.noErrorStreak, 10],
    precision_arc:             [ctx.noErrorStreak, 25],
    precision_couronne:        [ctx.noErrorStreak, 50],
    precision_parfaite:        [ctx.goalCounters?.['precision_parfaite'] ?? 0, 3],
    // Régularité (commence à 1 dès que le joueur a joué)
    regularite_aube:           [streakDisplay2, 3],
    regularite_fougere:        [streakDisplay2, 7],
    regularite_arbre:          [streakDisplay2, 30],
    regularite_foret:          [streakDisplay2, 100],
    // Social
    social_poignee:            [ctx.totalFriendsInvited >= 1 ? 1 : 0, 1],
    social_lion:               [ctx.friendWins, 5],
    social_loup:               [ctx.friendWins, 20],
    social_roi:                [ctx.friendWins, 50],
    social_cirque:             [ctx.totalFriendsInvited, 5],
    social_trophee:            [ctx.topDEJCount, 5],
    ami_challenger:            [ctx.totalFriendsInvited >= 1 ? 1 : 0, 1],
    ami_serial:                [ctx.friendWins, 100],
    // Amélioration
    amelioration_graphe:       [ctx.improvedChallengesCount ?? 0, 3],
    amelioration_discipline:   [ctx.improvedChallengesCount ?? 0, 5],
    amelioration_cycle:        [Math.min(ctx.retryStreakCount ?? 0, 3), 3],
    amelioration_etoile:       [(ctx.failCount === 0 && ctx.estimatedDurationMs > 0 && ctx.elapsedMs / ctx.estimatedDurationMs < 0.20) ? 1 : 0, 1],
    amelioration_fusee:        [Math.min(ctx.retryStreakFuseeCount ?? 0, 5), 5],
    // Exploration (niveaux)
    exploration_graine:        [niv3done,  3],
    exploration_herbe:         [niv5done,  5],
    exploration_chene:         [niv9done,  9],
    exploration_crane:         [niv13done, 13],
    exploration_cible:         [(ctx.bonusUsed?.length === 0 && ctx.challengeNumber === 10) ? 1 : 0, 1],
    exploration_collectionneur:[totalDone, 50],
    // ONF
    onf_forestier:             [ctx.onfSolvedCount ?? 0, 10],
    onf_maitre:                [ctx.onfSolvedCount ?? 0, 50],
    onf_precision:             [ctx.onfPerfectCount ?? 0, 3],
    onf_speed:                 [ctx.onfSpeedCount ?? 0, 3],
    // Daily
    daily_perfect:             [ctx.dailyPerfectCount ?? 0, 10],
    daily_speed:               [ctx.dailySpeedCount ?? 0, 3],
    // Vitesse marathon (basé sur speedBadgeHits tortue global)
    vitesse_marathon:          [ctx.speedBadgeHits?.['vitesse_tortue'] ?? 0, 20],
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
  const speedBadgeIdsSet = new Set(['vitesse_tortue', 'vitesse_loup', 'vitesse_oiseau', 'vitesse_eclair', 'vitesse_tornade']);
  if (speedBadgeIdsSet.has(badgeId)) {
    const current = Math.min(goalCounters2[badgeId] ?? 0, SPEED_BADGE_TARGET);
    return { badgeId, currentValue: current, targetValue: SPEED_BADGE_TARGET, percentage: current / SPEED_BADGE_TARGET, unit: 'count' };
  }

  // Précision : goalCounters[badgeId] = nb de défis consécutifs sans erreur depuis activation
  const precisionTargets: Record<string, number> = {
    precision_pousse: 3, precision_oeil: 5, precision_hibou: 10,
    precision_arc: 25, precision_couronne: 50,
    precision_parfaite: 3,
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
  // Pour la régularité : si le joueur a déjà joué (completedChallenges > 0), le minimum
  // affiché est 1 (la journée courante compte comme 1 dès l'ouverture de l'app).
  const streakDisplay = ctx.dailyStreak > 0 ? ctx.dailyStreak
    : (ctx.completedChallenges.length > 0 ? 1 : 0);
  const progressMap: Record<string, [number, number]> = {
    // Régularité
    regularite_aube:            [streakDisplay, 3],
    regularite_fougere:         [streakDisplay, 7],
    regularite_arbre:           [streakDisplay, 30],
    regularite_foret:           [streakDisplay, 100],
    // Social
    social_poignee:             [ctx.totalFriendsInvited >= 1 ? 1 : 0, 1],
    social_lion:                [ctx.friendWins, 5],
    social_loup:                [ctx.friendWins, 20],
    social_roi:                 [ctx.friendWins, 50],
    social_cirque:              [ctx.totalFriendsInvited, 5],
    social_trophee:             [ctx.topDEJCount, 5],
    ami_challenger:             [ctx.totalFriendsInvited >= 1 ? 1 : 0, 1],
    ami_serial:                 [ctx.friendWins, 100],
    // Amélioration
    amelioration_graphe:        [ctx.improvedChallengesCount ?? 0, 3],
    amelioration_discipline:    [ctx.improvedChallengesCount ?? 0, 5],
    amelioration_cycle:         [Math.min(ctx.retryStreakCount ?? 0, 3), 3],
    amelioration_etoile:        [(ctx.failCount === 0 && ctx.estimatedDurationMs > 0 && ctx.elapsedMs / ctx.estimatedDurationMs < 0.20) ? 1 : 0, 1],
    amelioration_fusee:         [Math.min(ctx.retryStreakFuseeCount ?? 0, 5), 5],
    // Exploration
    exploration_graine:         [niv3done2,  3],
    exploration_herbe:          [niv5done2,  5],
    exploration_chene:          [niv9done2,  9],
    exploration_crane:          [niv13done2, 13],
    exploration_cible:          [(ctx.bonusUsed?.length === 0 && ctx.challengeNumber === 10) ? 1 : 0, 1],
    exploration_collectionneur: [totalDone, 50],
    // ONF
    onf_forestier:              [ctx.onfSolvedCount ?? 0, 10],
    onf_maitre:                 [ctx.onfSolvedCount ?? 0, 50],
    onf_precision:              [ctx.onfPerfectCount ?? 0, 3],
    onf_speed:                  [ctx.onfSpeedCount ?? 0, 3],
    // Daily
    daily_first:                [Math.min(ctx.dailyCompleted ?? 0, 1), 1],
    daily_week:                 [Math.min(ctx.dailyStreak, 7), 7],
    daily_month:                [Math.min(ctx.dailyStreak, 30), 30],
    daily_champion:             [ctx.topDEJCount ?? 0, 1],
    daily_perfect:              [ctx.dailyPerfectCount ?? 0, 10],
    daily_speed:                [ctx.dailySpeedCount ?? 0, 3],
    // Vitesse marathon
    vitesse_marathon:           [ctx.speedBadgeHits?.['vitesse_tortue'] ?? 0, 20],
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
  const speedBadgeIdsSet = new Set(['vitesse_tortue', 'vitesse_loup', 'vitesse_oiseau', 'vitesse_eclair', 'vitesse_tornade']);
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
    ami_challenger:             0, // binaire
    ami_serial:                 ctx.friendWins ?? 0,
    amelioration_graphe:        ctx.improvedChallengesCount ?? 0,
    amelioration_discipline:    ctx.improvedChallengesCount ?? 0,
    amelioration_cycle:         ctx.retryStreakCount ?? 0,
    amelioration_etoile:        0, // binaire
    amelioration_fusee:         ctx.retryStreakFuseeCount ?? 0,
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
    daily_perfect:              ctx.dailyPerfectCount ?? 0,
    daily_speed:                ctx.dailySpeedCount ?? 0,
    onf_forestier:              ctx.onfSolvedCount ?? 0,
    onf_maitre:                 ctx.onfSolvedCount ?? 0,
    onf_precision:              ctx.onfPerfectCount ?? 0,
    onf_speed:                  ctx.onfSpeedCount ?? 0,
    precision_parfaite:         0, // goalCounter-based
    vitesse_marathon:           (ctx.speedBadgeHits ?? {})['vitesse_tortue'] ?? 0,
  };

  return valueMap[badgeId] ?? 0;
}


