// ============================================================
// trophyHint — la ligne unique « trophée » de la modale de victoire (Progression v2, C8)
//
// La modale de victoire ne montre plus le pavé des 3 prochains trophées (trop chargé). Elle affiche AU PLUS
// UNE ligne, et seulement quand elle a quelque chose d'utile à dire :
//   1. un trophée vient d'être obtenu → on le dit (« Trophée obtenu : … ») ;
//   2. sinon, un trophée est tout proche (>= 75 % de la cible, mais pas encore atteint) → on l'annonce ;
//   3. sinon rien : pas de ligne.
// Le détail (les 3 prochains trophées et leur barre) reste dans le Profil, rubrique Trophées.
//
// Fichier PUR (aucune dépendance React / Zustand) : testé par __tests__/trophyHint.test.ts.
// ============================================================

import type { TrophyProgress } from './trophies';

/** Un trophée est « tout proche » à partir de cette part de la cible (et tant qu'il n'est pas atteint). */
export const NEAR_TROPHY_RATIO = 0.75;

export type TrophyHint =
  | { kind: 'earned'; trophyId: string; extra: number }
  | { kind: 'near'; trophyId: string; seriesId: string; remaining: number };

/**
 * Ligne à afficher dans la modale de victoire, ou null.
 *  - `justEarned` : trophées obtenus CE tour (le premier est nommé ; `extra` = les autres) ;
 *  - `next` : prochains trophées (`getClosestTrophies`), triés du plus proche au plus lointain.
 */
export function pickTrophyHint(
  justEarned: readonly string[] | null | undefined,
  next: readonly TrophyProgress[] | null | undefined,
): TrophyHint | null {
  const earned = (justEarned ?? []).filter(id => typeof id === 'string' && id.length > 0);
  if (earned.length > 0) return { kind: 'earned', trophyId: earned[0], extra: earned.length - 1 };

  const near = (next ?? [])
    .filter(t => t.target > 0 && t.current < t.target && t.percentage >= NEAR_TROPHY_RATIO)
    .sort((a, b) => b.percentage - a.percentage)[0];
  if (!near) return null;
  return { kind: 'near', trophyId: near.trophyId, seriesId: near.seriesId, remaining: near.target - near.current };
}
