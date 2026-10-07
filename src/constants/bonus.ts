export type BonusId =
  | 'highlight_valid_cells'  // Allume les cases où le placement est légal pour l'élément sélectionné
  | 'instinct';              // Allume les cases en erreur sur le plateau (comparaison avec la solution)

export interface BonusDefinition {
  id: BonusId;
  label: string;
  description: string;
  icon: string;
  cost: number;               // Coût en graines
  requiresUnlock: boolean;    // true = débloqué uniquement via badges
}

export const BONUS_DEFINITIONS: Record<BonusId, BonusDefinition> = {
  highlight_valid_cells: {
    id: 'highlight_valid_cells',
    label: 'Cases valides',
    description: 'Indique les cases où le placement est possible selon les règles',
    icon: '💡',
    cost: 3,
    requiresUnlock: false,
  },
  instinct: {
    id: 'instinct',
    label: 'Instinct',
    description: 'Révèle les cases mal placées sur ton plateau',
    icon: '🔴',
    cost: 6,
    requiresUnlock: true,  // Débloqué via 3 badges Or (RARITY_UNLOCKS)
  },
};

/** Bonus toujours disponibles (pas de débloquage requis) */
export const BASE_BONUS_IDS: BonusId[] = ['highlight_valid_cells'];

/** Bonus avancés qui nécessitent un débloquage via badges */
export const ADVANCED_BONUS_IDS: BonusId[] = ['instinct'];
