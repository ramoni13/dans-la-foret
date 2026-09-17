export type BonusId =
  | 'highlight_valid_cells'  // Survol : allume les cases valides pour l'élément tenu
  | 'count_errors';          // Après validation : affiche le nombre d'erreurs

export interface BonusDefinition {
  id: BonusId;
  label: string;
  description: string;
  icon: string;
  cost: number;               // Coût en graines
  challengeTimePenalty: number; // Secondes ajoutées en mode défi
}

export const BONUS_DEFINITIONS: Record<BonusId, BonusDefinition> = {
  highlight_valid_cells: {
    id: 'highlight_valid_cells',
    label: 'Cases valides',
    description: 'Au survol d\'une case : s\'allume si le placement est possible, reste grise sinon',
    icon: '💡',
    cost: 3,
    challengeTimePenalty: 30,
  },
  count_errors: {
    id: 'count_errors',
    label: 'Compter les erreurs',
    description: 'Après validation : affiche le nombre de cases incorrectes',
    icon: '🔢',
    cost: 2,
    challengeTimePenalty: 15,
  },
};
