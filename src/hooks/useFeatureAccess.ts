// ============================================================
// useFeatureAccess — « ce mode est-il ouvert pour moi ? » (Progression v2, C3)
//
// Hook unique pour les écrans : il lit le niveau / les étoiles du joueur, le drapeau
// PROGRESSION_V2 et les contournements développeur, puis délègue à la logique pure de
// `src/constants/unlocks.ts`. Aucun écran ne porte plus de seuil de niveau.
// ============================================================

import { useMemo } from 'react';
import { PROGRESSION_V2 } from '../constants/featureFlags';
import { isDemoAccount, isDevAccount } from '../constants/devAccess';
import { computeLevelProgress, ProgressionFeature } from '../constants/progression';
import {
  LockHint,
  UnlockContext,
  getFeatureLockHint,
  getOpenDailyLeagues,
  getOpenOnfTiers,
  isFeatureAvailable,
} from '../constants/unlocks';
import { usePlayerStore } from '../store/playerStore';

export interface FeatureAccess {
  /** Le mode est-il ouvert ? */
  isOpen: (feature: ProgressionFeature) => boolean;
  /** Que montrer sur un mode verrouillé (chapitre ou niveau). */
  lockHint: (feature: ProgressionFeature) => LockHint;
  /** Paliers de Forestier ouverts. */
  onfTiers: Array<'sentier' | 'clairiere' | 'profonde'>;
  /** Ligues du Journalier ouvertes. */
  dailyLeagues: Array<'pousse' | 'grand_chene'>;
  /** true quand le déblocage se fait par chapitres (PROGRESSION_V2). */
  useChapters: boolean;
}

/**
 * `bypass` :
 *   - 'demo' → comptes de démonstration seulement ;
 *   - 'dev'  → comptes de développement (inclut la démo) ;
 *   - aucun  → pas de contournement.
 * Les contournements sont définis dans `devAccess.ts`.
 */
export function useFeatureAccess(bypass?: 'demo' | 'dev'): FeatureAccess {
  const username = usePlayerStore(s => s.username);
  const challengeStars = usePlayerStore(s => s.challengeStars);
  const currentLevel = usePlayerStore(s => s.currentLevel);

  return useMemo(() => {
    const progress = computeLevelProgress(challengeStars);
    const ctx: UnlockContext = {
      levelsCompleted: progress.levelsCompleted,
      currentLevel,
      useChapters: PROGRESSION_V2,
      bypass: bypass === 'demo' ? isDemoAccount(username) : bypass === 'dev' ? isDevAccount(username) : false,
    };
    return {
      isOpen: (feature) => isFeatureAvailable(feature, ctx),
      lockHint: (feature) => getFeatureLockHint(feature, PROGRESSION_V2),
      onfTiers: getOpenOnfTiers(ctx),
      dailyLeagues: getOpenDailyLeagues(ctx),
      useChapters: PROGRESSION_V2,
    };
  }, [username, challengeStars, currentLevel, bypass]);
}
