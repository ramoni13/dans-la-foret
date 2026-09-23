// ============================================================
// MOTEUR D'ÉVALUATION DES BADGES
// Fonction pure, idempotente, O(n) sur le catalogue.
// ============================================================

import { BonusId } from '../../constants/bonus';
import { BADGE_DEFINITIONS, BADGE_MAP, isInSeason } from '../../constants/badges';

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
  noErrorStreak: number;        // défis CONSÉCUTIFS sans erreur APRÈS mise à jour du store
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
 * Règle clé : les badges VITESSE comparent elapsedMs à une fraction de
 * estimatedDurationMs (pas à des seuils absolus en secondes), pour être
 * cohérents quel que soit le niveau de difficulté.
 *
 * @param ctx Contexte de la partie terminée
 * @returns Liste des badgeId à décerner (peut être vide)
 */
export function evaluateBadges(ctx: GameContext): string[] {
  const earned = new Set(ctx.earnedBadges);
  const newBadges: string[] = [];

  function award(badgeId: string) {
    if (!earned.has(badgeId)) {
      earned.add(badgeId);
      newBadges.push(badgeId);
    }
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

  // ── VITESSE ─────────────────────────────────────────────────────────────────
  // Seuils absolus en secondes, croissants par niveau.
  // Niveau 1 comme base, +N secondes par niveau supplémentaire.
  //
  //   Badge          | Niv 1 | +/niv | Niv 5 | Niv 10
  //   vitesse_tortue |  30 s |  +10  |  70 s | 120 s
  //   vitesse_renard |  20 s |   +7  |  48 s |  83 s
  //   vitesse_oiseau |  12 s |   +5  |  32 s |  57 s
  //   vitesse_eclair |   7 s |   +3  |  19 s |  34 s
  //   vitesse_tornade|   4 s |   +2  |  12 s |  22 s
  //
  // levelNumber est garanti >= 1.
  const lvl = Math.max(1, ctx.levelNumber);
  const threshold_tortue  = 30 + (lvl - 1) * 10;
  const threshold_renard  = 20 + (lvl - 1) * 7;
  const threshold_oiseau  = 12 + (lvl - 1) * 5;
  const threshold_eclair  =  7 + (lvl - 1) * 3;
  const threshold_tornade =  4 + (lvl - 1) * 2;

  if (elapsedSec < threshold_tortue)  award('vitesse_tortue');
  if (elapsedSec < threshold_renard)  award('vitesse_renard');
  if (elapsedSec < threshold_oiseau)  award('vitesse_oiseau');
  if (elapsedSec < threshold_eclair)  award('vitesse_eclair');
  if (elapsedSec < threshold_tornade) award('vitesse_tornade');

  // ── PRÉCISION ────────────────────────────────────────────────────────────────
  // errorCount === 0 = validation réussie du premier coup (pas de bouton Valider échoué).
  // La victoire elle-même est toujours errorCount=0 (le jeu ne permet la victoire qu'à 0 erreur),
  // mais on distingue "0 erreur à chaque validation" via noErrorStreak.
  // Le badge "Première pousse" se gagne après 1 défi sans AUCUN échec intermédiaire.
  if (ctx.failCount === 0) {
    // Aucun bouton Valider raté pendant cette partie
    award('precision_pousse');
    if (ctx.noErrorStreak >= 3)  award('precision_oeil');
    if (ctx.noErrorStreak >= 10) award('precision_hibou');
    if (ctx.noErrorStreak >= 25) award('precision_arc');
    if (ctx.noErrorStreak >= 50) award('precision_couronne');
  }

  // ── RÉGULARITÉ ───────────────────────────────────────────────────────────────
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
  if (ctx.totalFriendsInvited >= 1)  award('social_poignee');
  if (ctx.friendWins >= 5)           award('social_lion');
  if (ctx.friendWins >= 20)          award('social_loup');
  if (ctx.friendWins >= 50)          award('social_roi');
  if (ctx.totalFriendsInvited >= 5)  award('social_cirque');
  if (ctx.topDEJCount >= 5)          award('social_trophee');

  // ── AMÉLIORATION ─────────────────────────────────────────────────────────────
  if (isPersonalBest(ctx)) {
    award('amelioration_graphe');
  }

  // "Persévérant" : a rejoué le même défi >= 3 fois (sameChallengePlays est AVANT cette partie)
  const playsOnThisChallenge = (ctx.sameChallengePlays[ctx.challengeId] ?? 0) + 1;
  if (playsOnThisChallenge >= 3) {
    award('amelioration_cycle');
  }

  // "Perfection absolue" : terminé en < 20% du temps estimé ET sans aucun échec
  if (ratio < 0.20 && ctx.failCount === 0) {
    award('amelioration_etoile');
  }

  // ── EXPLORATION ──────────────────────────────────────────────────────────────
  // "Premiers pas" : niveaux 1, 2, 3 entièrement complétés
  if (['niveau_1', 'niveau_2', 'niveau_3'].every(n => completedLevels.includes(n))) {
    award('exploration_graine');
  }

  // "Explorateur confirmé" : niveaux 1 à 5
  if (['niveau_1', 'niveau_2', 'niveau_3', 'niveau_4', 'niveau_5'].every(n => completedLevels.includes(n))) {
    award('exploration_herbe');
  }

  // "Vieux chêne" : niveaux 1 à 9
  const n1_9 = ['niveau_1','niveau_2','niveau_3','niveau_4','niveau_5',
                 'niveau_6','niveau_7','niveau_8','niveau_9'];
  if (n1_9.every(n => completedLevels.includes(n))) {
    award('exploration_chene');
  }

  // "Maître des profondeurs" : tous les niveaux (1 à 13)
  const allLevels = [...n1_9, 'niveau_10','niveau_11','niveau_12','niveau_13'];
  if (allLevels.every(n => completedLevels.includes(n))) {
    award('exploration_crane');
  }

  // "Sans bonus" : complète le dernier défi d'un niveau (n°10) sans bonus
  // et tous les 9 précédents sont déjà complétés
  if (ctx.bonusUsed.length === 0 && ctx.challengeNumber === 10) {
    const levelDone = completedInLevel(ctx.levelId, completedBefore).length >= 9;
    if (levelDone) {
      award('exploration_cible');
    }
  }

  // "Collectionneur" : 50 défis complétés (APRÈS ajout du défi courant)
  const totalDone = completedBefore.length + 1;
  if (totalDone >= 50) {
    award('exploration_collectionneur');
  }

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

// ── Calcul de la progression vers les badges non encore obtenus ───────────────

export interface BadgeProgress {
  badgeId: string;
  currentValue: number;
  targetValue: number;
  percentage: number; // 0–1
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

  // Seuils vitesse identiques à evaluateBadges (secondes, croissants par niveau)
  const lvl2        = Math.max(1, ctx.levelNumber);
  const t_tortue    = 30 + (lvl2 - 1) * 10;
  const t_renard    = 20 + (lvl2 - 1) * 7;
  const t_oiseau    = 12 + (lvl2 - 1) * 5;
  const t_eclair    =  7 + (lvl2 - 1) * 3;
  const t_tornade   =  4 + (lvl2 - 1) * 2;
  const elapsedS    = ctx.elapsedMs / 1000;

  // ── Badges vitesse : pourcentage inversé (moins de temps = plus proche du badge) ──
  // percentage = 1 - (elapsedSec / threshold), clampé entre 0 et 1.
  // Si elapsedSec < threshold → badge déjà décerné dans evaluateBadges (earnedSet).
  const speedBadges: Array<[string, number]> = [
    ['vitesse_tortue',  t_tortue],
    ['vitesse_renard',  t_renard],
    ['vitesse_oiseau',  t_oiseau],
    ['vitesse_eclair',  t_eclair],
    ['vitesse_tornade', t_tornade],
  ];
  for (const [badgeId, threshold] of speedBadges) {
    if (earned.has(badgeId)) continue;
    if (!BADGE_MAP[badgeId]) continue;
    const pct = Math.max(0, Math.min(1, 1 - (elapsedS / (threshold * 2))));
    result.push({
      badgeId,
      currentValue: Math.round(elapsedS),
      targetValue:  Math.round(threshold),
      percentage:   pct,
    });
  }

  // ── Autres badges : current/target linéaires ──────────────────────────────────
  const progressMap: Record<string, [number, number]> = {
    precision_pousse:          [ctx.failCount === 0 ? 1 : 0, 1],
    precision_oeil:            [ctx.noErrorStreak, 3],
    precision_hibou:           [ctx.noErrorStreak, 10],
    precision_arc:             [ctx.noErrorStreak, 25],
    precision_couronne:        [ctx.noErrorStreak, 50],
    regularite_aube:           [ctx.dailyStreak, 3],
    regularite_fougere:        [ctx.dailyStreak, 7],
    regularite_arbre:          [ctx.dailyStreak, 30],
    regularite_foret:          [ctx.dailyStreak, 100],
    social_lion:               [ctx.friendWins, 5],
    social_loup:               [ctx.friendWins, 20],
    social_roi:                [ctx.friendWins, 50],
    social_cirque:             [ctx.totalFriendsInvited, 5],
    social_trophee:            [ctx.topDEJCount, 5],
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
