export type BonusId =
  | 'highlight_valid_cells'  // Allume les cases où le placement est légal pour l'élément sélectionné
  | 'instinct';              // Allume les cases en erreur sur le plateau (comparaison avec la solution)

export interface BonusDefinition {
  id: BonusId;
  label: string;
  description: string;
  icon: string;
  /** @deprecated Coût en graines — conservé pour référence, plus utilisé en jeu (chantier 4) */
  cost: number;
  requiresUnlock: boolean;    // true = débloqué uniquement via badges
  /** Nombre d'utilisations journalières offertes (reset à minuit, chantier 4) */
  dailyLimit: number;
}

export const BONUS_DEFINITIONS: Record<BonusId, BonusDefinition> = {
  highlight_valid_cells: {
    id: 'highlight_valid_cells',
    label: 'Cases valides',
    description: 'Indique les cases où le placement est possible selon les règles',
    icon: '💡',
    cost: 3,           // legacy — non utilisé depuis chantier 4
    requiresUnlock: false,
    dailyLimit: 5,
  },
  instinct: {
    id: 'instinct',
    label: 'Instinct',
    description: 'Révèle les cases mal placées sur ton plateau',
    icon: '🔴',
    cost: 6,           // legacy — non utilisé depuis chantier 4
    requiresUnlock: false, // Disponible pour tous, 5 utilisations/jour
    dailyLimit: 5,
  },
};

/** Bonus toujours disponibles (pas de débloquage requis) */
export const BASE_BONUS_IDS: BonusId[] = ['highlight_valid_cells', 'instinct'];

/** Bonus avancés qui nécessitent un débloquage via badges */
export const ADVANCED_BONUS_IDS: BonusId[] = [];
