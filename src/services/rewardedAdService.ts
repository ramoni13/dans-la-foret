// ============================================================
// PUBLICITÉS RÉCOMPENSÉES — point d'entrée unique (Lot B)
//
// TOUS les écrans passent par `showRewardedAd`. Aujourd'hui l'implémentation est une SIMULATION (compte à rebours de
// 5 s dans `RewardedAdModal`) : aucun SDK publicitaire n'est installé, aucune pub réelle, aucun revenu.
//
// Lot E : remplacer UNIQUEMENT le corps de `showRewardedAd` (et `isRewardedAdReady`) par
// `react-native-google-mobile-ads` (RewardedAd, événement EARNED_REWARD) + consentement UMP / ATT. Aucun écran
// n'est à modifier : ils consomment `RewardedAdResult`.
//
// Contrat : `earned = true` seulement si le joueur a regardé la pub JUSQU'AU BOUT (récompense méritée). Fermer avant
// la fin, une erreur de chargement ou l'absence de pub donnent `earned = false` : la récompense n'est jamais versée.
// ============================================================

import type { AdPlacement } from '../constants/adRewards';

export type RewardedAdOutcome =
  | 'earned'      // pub regardée en entier : récompense due
  | 'dismissed'   // fermée avant la fin
  | 'unavailable' // aucune pub disponible (hors-ligne, pas de remplissage) : le joueur n'est pas pénalisé
  | 'error';

export interface RewardedAdResult {
  outcome: RewardedAdOutcome;
  /** Raccourci : `outcome === 'earned'`. */
  earned: boolean;
}

/** Durée de la pub simulée (ms). Lue par `RewardedAdModal`. */
export const SIMULATED_AD_DURATION_MS = 5_000;

type Presenter = (placement: AdPlacement) => Promise<RewardedAdResult>;

let presenter: Presenter | null = null;

/**
 * Enregistré UNE FOIS par `RewardedAdHost` (monté dans le layout racine) : c'est lui qui affiche la modale de pub
 * simulée. Le Lot E n'en aura plus besoin (le SDK affiche sa propre pub plein écran).
 * La pub n'est lancée que depuis l'accueil (Forêt commune), jamais depuis une modale native : la `Modal` du layout
 * racine passerait sinon SOUS une modale déjà ouverte.
 */
export function registerRewardedAdPresenter(p: Presenter | null): void {
  presenter = p;
}

export function makeResult(outcome: RewardedAdOutcome): RewardedAdResult {
  return { outcome, earned: outcome === 'earned' };
}

/** Une pub est-elle prête à être montrée ? (Simulation : toujours, tant que l'hôte est monté.) */
export function isRewardedAdReady(): boolean {
  return presenter !== null;
}

/**
 * Montre une pub récompensée pour `placement` et attend son issue. Ne verse AUCUNE récompense : l'appelant appelle
 * ensuite `playerStore.claimAdReward(placement)` si `result.earned`.
 */
export async function showRewardedAd(placement: AdPlacement): Promise<RewardedAdResult> {
  if (!presenter) return makeResult('unavailable');
  try {
    return await presenter(placement);
  } catch {
    return makeResult('error');
  }
}
