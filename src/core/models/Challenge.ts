// ============================================================
// MODÈLE D'UN DÉFI
// La solution est pré-calculée UNE SEULE FOIS par le solveur.
// Pendant le gameplay : vérification = comparaison de tableaux.
// playerBoard[i] === challenge.solution[i] → pas de calcul.
// ============================================================

export interface Challenge {
  id: string;
  boardId: string;              // Référence au plateau utilisé
  level: DifficultyLevel;
  levelNumber: number;
  challengeNumber: number;

  // Jetons pré-placés (non déplaçables par le joueur)
  fixedPlacements: FixedPlacement[];

  // Inventaire des jetons disponibles pour le joueur
  availableTokens: TokenCount[];

  // ✅ Solution unique pré-calculée par le solveur
  // solution[i] = elementId de la case i dans la solution finale
  // C'est cette solution qui guide TOUT le gameplay
  solution: string[];

  // Métadonnées
  solutionCount: number;        // Doit toujours être 1
  estimatedDuration: number;    // En secondes
  createdAt: string;            // ISO date string
}

export interface FixedPlacement {
  cellIndex: number;
  elementId: string;
}

export interface TokenCount {
  elementId: string;
  count: number;
}

// Plateaux : 6 (niv 1) · 7 (2) · 8 (3-4) · 9 (5-6) · 10 (7-8) · 11 (9-11) · 12 (12-15) · 13 (16-18) · 14 (19-21)
export type DifficultyLevel =
  | 'niveau_1' | 'niveau_2' | 'niveau_3' | 'niveau_4' | 'niveau_5'
  | 'niveau_6'
  | 'niveau_7' | 'niveau_8' | 'niveau_9'
  | 'niveau_10'
  | 'niveau_11' | 'niveau_12' | 'niveau_13' | 'niveau_14' | 'niveau_15'
  | 'niveau_16' | 'niveau_17' | 'niveau_18' // 13 cases — Cœur de la Forêt
  | 'niveau_19' | 'niveau_20' | 'niveau_21'; // 14 cases — Cœur Profond (+ Arbre)
