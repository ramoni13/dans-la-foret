// ============================================================
// useRewardedAd — « regarder une pub volontaire » (recharge d'un bonus, Forêt commune)
//
// Enchaîne : plafond du jour → pub → crédit. Un emplacement par appel.
//   const bonus = useRewardedAd('bonus_reveal_cell');
//   bonus.available   // pub proposable maintenant (non premium pour un bonus, plafond non atteint, pub prête)
//   bonus.remaining   // visionnages restants aujourd'hui
//   await bonus.watch() // → true si la pub a été regardée ET le crédit fait
//
// Le crédit passe TOUJOURS par `playerStore.claimAdReward`, qui revérifie le plafond et l'état de la réserve :
// un double tap ou une course entre deux écrans ne peut pas créditer deux fois.
// ============================================================

import { useCallback, useRef, useState } from 'react';
import { AdPlacement, getAdRemaining, isPlacementAvailableToPremium } from '../constants/adRewards';
import { usePlayerStore } from '../store/playerStore';
import { isRewardedAdReady, showRewardedAd } from '../services/rewardedAdService';

export interface UseRewardedAd {
  /** Une pub peut être proposée pour cet emplacement. */
  available: boolean;
  /** Visionnages encore possibles aujourd'hui (plafond - déjà vus). */
  remaining: number;
  /** Une pub est en cours (évite le double tap). */
  busy: boolean;
  /** Montre la pub puis crédite. `true` = récompense créditée. */
  watch: () => Promise<boolean>;
}

export function useRewardedAd(placement: AdPlacement): UseRewardedAd {
  const isPremium = usePlayerStore(s => s.isPremium);
  const adViews = usePlayerStore(s => s.adViews);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const remaining = getAdRemaining(adViews, placement);
  const allowedForPlayer = !isPremium || isPlacementAvailableToPremium(placement);
  const available = allowedForPlayer && remaining > 0 && isRewardedAdReady();

  const watch = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await showRewardedAd(placement);
      if (!result.earned) return false;
      return usePlayerStore.getState().claimAdReward(placement);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [placement]);

  return { available, remaining, busy, watch };
}
