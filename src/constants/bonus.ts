export type BonusId =
  | 'highlight_valid_cells'  // Survol : allume les cases valides pour l'élément tenu
  | 'count_errors'           // Après validation : affiche le nombre d'erreurs
  | 'instinct'               // NOUVEAU — révèle aléatoirement une case incorrecte (halo rouge)
  | 'flash';                 // NOUVEAU — révèle aléatoirement une case vide correcte pendant 3s

export interface BonusDefinition {
  id: BonusId;
  label: string;
  description: string;
  icon: string;
  cost: number;               // Coût en graines
  challengeTimePenalty: number; // Secondes ajoutées en mode défi
  requiresUnlock: boolean;    // true = débloqué uniquement via badges (pas disponible par défaut)
}

export const BONUS_DEFINITIONS: Record<BonusId, BonusDefinition> = {
  highlight_valid_cells: {
    id: 'highlight_valid_cells',
    label: 'Cases valides',
    description: 'Au survol d\'une case : s\'allume si le placement est possible, reste grise sinon',
    icon: '💡',
    cost: 3,
    challengeTimePenalty: 30,
    requiresUnlock: false,
  },
  count_errors: {
    id: 'count_errors',
    label: 'Compter les erreurs',
    description: 'Après validation : affiche le nombre de cases incorrectes',
    icon: '🔢',
    cost: 2,
    challengeTimePenalty: 15,
    requiresUnlock: false,
  },
  instinct: {
    id: 'instinct',
    label: 'Instinct',
    description: 'Révèle aléatoirement une case incorrecte de ton plateau (halo rouge)',
    icon: '🔴',
    cost: 6,
    challengeTimePenalty: 45,
    requiresUnlock: true,  // Débloqué via 3 badges Or (RARITY_UNLOCKS)
  },
  flash: {
    id: 'flash',
    label: 'Flash',
    description: 'Révèle la bonne réponse sur une case vide pendant 3 secondes — mémorise vite !',
    icon: '⚡',
    cost: 8,
    challengeTimePenalty: 60,
    requiresUnlock: true,  // Débloqué via 5 badges Pierre (RARITY_UNLOCKS)
  },
};

/** Bonus toujours disponibles (pas de débloquage requis) */
export const BASE_BONUS_IDS: BonusId[] = ['highlight_valid_cells', 'count_errors'];

/** Bonus avancés qui nécessitent un débloquage via badges */
export const ADVANCED_BONUS_IDS: BonusId[] = ['instinct', 'flash'];
