// ============================================================
// DÉBLOCAGES DES MODES — Dans la Forêt (Progression v2, C3)
//
// Point d'entrée UNIQUE pour savoir si un mode est ouvert. Les écrans ne portent plus aucun
// seuil de niveau : ils appellent `isFeatureAvailable` et affichent `getFeatureLockHint`.
//
//   useChapters = true  (PROGRESSION_V2) : un mode s'ouvre à la fin d'un CHAPITRE, via
//                         `isFeatureUnlocked` (src/constants/progression.ts) ;
//   useChapters = false (ancien système)  : seuils de niveau historiques (LEGACY_UNLOCK_LEVELS).
//
// Fichier PUR (aucune dépendance React / Zustand / Firebase) : testé par __tests__/unlocks.test.ts.
// Le drapeau et les comptes de démonstration sont passés par l'appelant.
// ============================================================

import {
  FEATURE_UNLOCK_CHAPTER,
  ProgressionFeature,
  isFeatureUnlocked,
} from './progression';

/**
 * Anciens seuils de niveau (pré-Progression v2). Utilisés UNIQUEMENT quand `useChapters` est faux.
 * Le Forestier n'avait qu'un seuil (niveau 14) : il vaut pour les 3 paliers.
 */
export const LEGACY_UNLOCK_LEVELS: Readonly<Record<ProgressionFeature, number>> = {
  duel: 3,
  daily_pousse: 9,
  daily_grand_chene: 9,
  onf_sentier: 14,
  onf_clairiere: 14,
  onf_profonde: 14,
  // L'Herbier par régions n'existe pas avant la Progression v2 : jamais verrouillé à l'ancienne.
  herbier_europe: 1,
  herbier_monde: 1,
  herbier_remarquables: 1,
};

/** Niveau requis pour accéder au Défi du Jour (ancien système). */
export const DAILY_UNLOCK_LEVEL = LEGACY_UNLOCK_LEVELS.daily_pousse;

/** Niveau requis pour accéder au Défi entre amis (ancien système). */
export const FRIENDS_UNLOCK_LEVEL = LEGACY_UNLOCK_LEVELS.duel;

export interface UnlockContext {
  /** Niveaux consécutifs validés (0 à 21). */
  levelsCompleted: number;
  /** Niveau jouable le plus haut (ancien système et niveau courant). */
  currentLevel: number;
  /** true → déblocage par chapitres (PROGRESSION_V2). */
  useChapters: boolean;
  /** true → contournement (compte démo / développeur) : tout est ouvert. */
  bypass?: boolean;
}

/** Le mode `feature` est-il ouvert pour ce joueur ? */
export function isFeatureAvailable(feature: ProgressionFeature, ctx: UnlockContext): boolean {
  if (ctx.bypass) return true;
  if (ctx.useChapters) return isFeatureUnlocked(feature, { levelsCompleted: ctx.levelsCompleted });
  return ctx.currentLevel >= LEGACY_UNLOCK_LEVELS[feature];
}

export type LockHint =
  /** Débloqué à la fin du chapitre `chapterId`. */
  | { kind: 'chapter'; chapterId: number }
  /** Débloqué au niveau `level` (ancien système). */
  | { kind: 'level'; level: number };

/** Ce qu'il faut afficher sur un mode verrouillé. */
export function getFeatureLockHint(feature: ProgressionFeature, useChapters: boolean): LockHint {
  return useChapters
    ? { kind: 'chapter', chapterId: FEATURE_UNLOCK_CHAPTER[feature] }
    : { kind: 'level', level: LEGACY_UNLOCK_LEVELS[feature] };
}

/**
 * Clé i18n et variables du message « verrouillé » d'un mode, selon le système actif.
 *   chapitres : « Disponible à la fin du chapitre {{chapter}} » ;
 *   niveaux   : « Disponible au niveau {{level}} » (ancien libellé inchangé).
 * `chapterName` / `levelLabel` sont fournis par l'appelant (déjà traduits).
 */
export function getLockMessageKey(hint: LockHint): { key: string; vars: Record<string, string> } {
  return hint.kind === 'chapter'
    ? { key: 'unlock_at_chapter', vars: { chapter: String(hint.chapterId) } }
    : { key: 'daily_locked', vars: { level: String(hint.level) } };
}

/**
 * Palier de Forestier le plus accessible parmi ceux ouverts, ou null si aucun.
 * Le Forestier est ouvert dès que le Sentier l'est ; les paliers suivants s'ajoutent (Lot 5).
 */
export function getOpenOnfTiers(ctx: UnlockContext): Array<'sentier' | 'clairiere' | 'profonde'> {
  const tiers: Array<'sentier' | 'clairiere' | 'profonde'> = [];
  if (isFeatureAvailable('onf_sentier', ctx)) tiers.push('sentier');
  if (isFeatureAvailable('onf_clairiere', ctx)) tiers.push('clairiere');
  if (isFeatureAvailable('onf_profonde', ctx)) tiers.push('profonde');
  return tiers;
}

/** Ligues du Journalier ouvertes (Lot 6 les utilisera ; la plus haute est celle où l'on joue). */
export function getOpenDailyLeagues(ctx: UnlockContext): Array<'pousse' | 'grand_chene'> {
  const leagues: Array<'pousse' | 'grand_chene'> = [];
  if (isFeatureAvailable('daily_pousse', ctx)) leagues.push('pousse');
  if (isFeatureAvailable('daily_grand_chene', ctx)) leagues.push('grand_chene');
  return leagues;
}
