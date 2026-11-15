export type BonusId =
  | 'reveal_cell'  // Révèle la solution d'une case pendant 10 secondes
  | 'instinct';    // Allume les cases en erreur sur le plateau (comparaison avec la solution)

export interface BonusDefinition {
  id: BonusId;
  label: string;
  description: string;
  icon: string;
  /** Nombre d'utilisations journalières offertes (reset à minuit) — sans quota quotidien en Premium */
  dailyLimit: number;
}

export const BONUS_USES_PER_CHALLENGE = 1;

export function canUseBonusInAttempt(bonusUsed: readonly BonusId[], bonusId: BonusId): boolean {
  return bonusUsed.filter(usedId => usedId === bonusId).length < BONUS_USES_PER_CHALLENGE;
}

export const BONUS_DEFINITIONS: Record<BonusId, BonusDefinition> = {
  reveal_cell: {
    id: 'reveal_cell',
    label: '1 case offerte',
    description: 'Révèle la solution d\'une case pendant 10 secondes',
    icon: '🎁',
    dailyLimit: 3,
  },
  instinct: {
    id: 'instinct',
    label: 'Instinct',
    description: 'Révèle les cases mal placées sur ton plateau',
    icon: '🔴',
    dailyLimit: 3,
  },
};

/** Bonus disponibles pour tous les joueurs */
export const BASE_BONUS_IDS: BonusId[] = ['reveal_cell', 'instinct'];

/** Bonus avancés réservés au premium (aucun pour l'instant) */
export const ADVANCED_BONUS_IDS: BonusId[] = [];
