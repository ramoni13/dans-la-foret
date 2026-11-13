// ============================================================
// PUBLICITÉS RÉCOMPENSÉES — emplacements, plafonds quotidiens : logique pure
//
// Une pub est TOUJOURS volontaire. Trois usages, et trois seulement :
//  - `foret_commune` : contribuer à la plantation de vrais arbres (accueil), pour tous (free et premium) ;
//  - `bonus_reveal_cell` / `bonus_instinct` : recharger UN bonus épuisé (joueur gratuit uniquement : le premium a
//    déjà des bonus illimités, donc aucune pub ne lui est proposée pour cela) ;
//  - `onf_recharge` : recharger le quota global de défis (joueur gratuit uniquement, UNE fois par jour,
//    et seulement quand le quota du jour est épuisé : +CHALLENGE_AD_RECHARGE_COUNT défis). Le premium n'a pas de quota.
// Aucune pub ne donne de graines ni de jeton de Duel : aucun déséquilibre free / premium sur la progression ni sur
// les classements.
//
// Aucune dépendance React / Zustand / Firebase : testé dans __tests__/adRewards.test.ts.
//
// Chaque emplacement a un plafond de visionnages PAR JOUR. Le compteur (`adViews`) fait partie des limites
// quotidiennes (`dailyLimits.ts`) : il est persisté (AsyncStorage + Firestore) et remis à zéro chaque jour.
// ============================================================

export type AdPlacement =
  | 'bonus_reveal_cell' // recharge du bonus « Révéler une case » (retour à 3 utilisations)
  | 'bonus_instinct'    // recharge du bonus « Instinct » (retour à 3 utilisations)
  | 'foret_commune'     // contribution à la Forêt commune
  | 'onf_recharge';     // identifiant historique : recharge du quota global (+3 défis, 1 fois par jour)

export const AD_PLACEMENTS: readonly AdPlacement[] = [
  'bonus_reveal_cell',
  'bonus_instinct',
  'foret_commune',
  'onf_recharge',
] as const;

/** Défis tous modes ajoutés par UNE vidéo quand le quota quotidien est épuisé. */
export const CHALLENGE_AD_RECHARGE_COUNT = 3;

/**
 * Visionnages maximum par jour et par emplacement.
 *  - bonus : 3 recharges par bonus (donc 6 pubs par jour au plus pour les deux bonus) ;
 *  - Forêt commune : 5 ;
 *  - recharge du quota global de défis : 1.
 * Valeurs à ajuster après mesure (taux de visionnage, rétention) : elles ne sont lues qu'ici.
 */
export const AD_DAILY_CAPS: Record<AdPlacement, number> = {
  bonus_reveal_cell: 3,
  bonus_instinct: 3,
  foret_commune: 5,
  onf_recharge: 1,
};

/** Visionnages du jour par emplacement (un emplacement absent vaut 0). */
export type AdViews = Partial<Record<AdPlacement, number>>;

/**
 * Un joueur premium ne voit jamais de pub, sauf pour la Forêt commune : c'est un don volontaire (il a déjà planté un
 * arbre à l'achat) et il garde le bouton « Contribuer ». Les bonus sont déjà illimités pour lui : aucune recharge.
 */
export function isPlacementAvailableToPremium(placement: AdPlacement): boolean {
  return placement === 'foret_commune';
}

/** Emplacement de recharge d'un bonus (`null` si l'identifiant n'est pas un bonus rechargeable). */
export function bonusPlacement(bonusId: string): AdPlacement | null {
  if (bonusId === 'reveal_cell') return 'bonus_reveal_cell';
  if (bonusId === 'instinct') return 'bonus_instinct';
  return null;
}

/** Visionnages déjà faits aujourd'hui pour cet emplacement. */
export function getAdViews(views: AdViews | null | undefined, placement: AdPlacement): number {
  const n = views?.[placement];
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Visionnages encore possibles aujourd'hui pour cet emplacement. */
export function getAdRemaining(views: AdViews | null | undefined, placement: AdPlacement): number {
  return Math.max(0, AD_DAILY_CAPS[placement] - getAdViews(views, placement));
}

/** Le plafond du jour est-il encore ouvert pour cet emplacement ? */
export function canWatchAd(views: AdViews | null | undefined, placement: AdPlacement): boolean {
  return getAdRemaining(views, placement) > 0;
}

/**
 * Compte un visionnage. Retourne un NOUVEL objet ; si le plafond est atteint, retourne le même objet (inchangé),
 * ce qui permet de détecter le refus par comparaison de référence.
 */
export function addAdView(views: AdViews | null | undefined, placement: AdPlacement): AdViews {
  const current = views ?? {};
  if (!canWatchAd(current, placement)) return current;
  return { ...current, [placement]: getAdViews(current, placement) + 1 };
}

/**
 * Compteurs lus depuis une source non fiable : seuls les emplacements connus sont gardés, bornés entre 0 et leur
 * plafond (les anciens emplacements — grille Forestier, jeton de Duel, graines ×2 — sont écartés).
 * `legacyWatchAdUsed` : ancienne sauvegarde (avant les recharges par bonus) où la recharge unique avait déjà été
 * utilisée aujourd'hui — les deux bonus sont alors comptés comme déjà rechargés au maximum (aucune pub en plus).
 */
export function sanitizeAdViews(raw: unknown, legacyWatchAdUsed = false): AdViews {
  const out: AdViews = {};
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    for (const p of AD_PLACEMENTS) {
      const v = r[p];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[p] = Math.min(AD_DAILY_CAPS[p], Math.floor(v));
    }
  } else if (legacyWatchAdUsed) {
    out.bonus_reveal_cell = AD_DAILY_CAPS.bonus_reveal_cell;
    out.bonus_instinct = AD_DAILY_CAPS.bonus_instinct;
  }
  return out;
}

/** Fusion de deux compteurs du même jour : le plus élevé par emplacement (un visionnage fait ne s'annule jamais). */
export function mergeAdViews(a: AdViews | null | undefined, b: AdViews | null | undefined): AdViews {
  const out: AdViews = {};
  for (const p of AD_PLACEMENTS) {
    const v = Math.max(getAdViews(a, p), getAdViews(b, p));
    if (v > 0) out[p] = v;
  }
  return out;
}

/** Les deux bonus rechargeables, dans l'ordre d'affichage. */
export const BONUS_AD_PLACEMENTS: readonly AdPlacement[] = ['bonus_reveal_cell', 'bonus_instinct'] as const;
