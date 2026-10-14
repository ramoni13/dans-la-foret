export type BonusId =
  | 'highlight_valid_cells'  // Allume les cases où le placement est légal pour l'élément sélectionné
  | 'instinct';              // Allume les cases en erreur sur le plateau (comparaison avec la solution)

export interface BonusDefinition {
  id: BonusId;
  label: string;
  description: string;
  icon: string;
  /** Nombre d'utilisations journalières offertes (reset à minuit) — illimité en premium */
  dailyLimit: number;
}

export const BONUS_DEFINITIONS: Record<BonusId, BonusDefinition> = {
  highlight_valid_cells: {
    id: 'highlight_valid_cells',
    label: 'Cases valides',
    description: 'Indique les cases où le placement est possible selon les règles',
    icon: '💡',
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
export const BASE_BONUS_IDS: BonusId[] = ['highlight_valid_cells', 'instinct'];

/** Bonus avancés réservés au premium (aucun pour l'instant) */
export const ADVANCED_BONUS_IDS: BonusId[] = [];
