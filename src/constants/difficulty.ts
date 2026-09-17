// ============================================================
// PARAMÈTRES DE DIFFICULTÉ — 13 niveaux
//
// 3 leviers combinés :
//   1. Plateau : 6 → 8 → 10 → 12 cases
//   2. Composition : nombre et types d'éléments
//   3. Cases vides : valeur FIXE et unique par niveau (pas de plage)
//
// Progression des cases vides :
//   Niv 1  : 6 cases, 3 vides
//   Niv 2  : 6 cases, 4 vides
//   Niv 3  : 8 cases, 3 vides
//   Niv 4  : 8 cases, 4 vides
//   Niv 5  : 8 cases, 5 vides
//   Niv 6  : 10 cases, 4 vides
//   Niv 7  : 10 cases, 5 vides
//   Niv 8  : 10 cases, 6 vides
//   Niv 9  : 12 cases, 5 vides
//   Niv 10 : 12 cases, 6 vides
//   Niv 11 : 12 cases, 7 vides
//   Niv 12 : 12 cases, 8 vides
//   Niv 13 : 12 cases, 9 vides
//
// Nouveaux éléments introduits progressivement :
//   Niv 1-5  : Bucheron, Ours, Mouton (+ Chien dès niv 2)
//   Niv 6-8  : mêmes éléments, plateau 10 cases
//   Niv 9-10 : plateau 12 cases, 4 types
//   Niv 11   : + Chalet (doit avoir un Bucheron voisin)
//   Niv 12-13: + Renard (ne peut pas être voisin d'un Mouton)
// ============================================================

export type DifficultyLevel =
  | 'niveau_1' | 'niveau_2' | 'niveau_3' | 'niveau_4' | 'niveau_5'
  | 'niveau_6' | 'niveau_7' | 'niveau_8' | 'niveau_9' | 'niveau_10'
  | 'niveau_11' | 'niveau_12' | 'niveau_13';

export interface Composition {
  bucheron?: number;
  ours?: number;
  mouton?: number;
  chien?: number;
  chalet?: number;
  renard?: number;
}

export interface LevelParams {
  boardId: string;                   // Plateau utilisé
  cellCount: number;                 // Nombre de cases du plateau
  compositions: Composition[];       // Compositions possibles (total = cellCount)
  emptyCellsRange: [number, number]; // [min, max] — ici toujours [N, N] (valeur fixe)
  bonusDisabled: boolean;
  estimatedDurationRange: [number, number]; // [min, max] en secondes
}

export const LEVEL_PARAMS: Record<DifficultyLevel, LevelParams> = {

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 6 CASES — niveaux 1 et 2
  // ────────────────────────────────────────────────────────────────

  niveau_1: {
    // 3 types, symétriques, 3 vides fixes — introduction en douceur
    boardId: 'board_6_v1',
    cellCount: 6,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 2 },
      { bucheron: 2, ours: 2, chien: 2 },
      { bucheron: 2, mouton: 2, chien: 2 },
      { ours: 2, mouton: 2, chien: 2 },
    ],
    emptyCellsRange: [3, 3],
    bonusDisabled: false,
    estimatedDurationRange: [60, 150],
  },

  niveau_2: {
    // 4 types avec Chien, 4 vides fixes — 1ère règle "require voisin"
    boardId: 'board_6_v1',
    cellCount: 6,
    compositions: [
      { bucheron: 2, ours: 1, mouton: 1, chien: 2 },
      { bucheron: 1, ours: 2, mouton: 1, chien: 2 },
      { bucheron: 1, ours: 1, mouton: 2, chien: 2 },
      { bucheron: 2, ours: 2, mouton: 1, chien: 1 },
      { bucheron: 2, ours: 1, mouton: 2, chien: 1 },
      { bucheron: 1, ours: 2, mouton: 2, chien: 1 },
      { bucheron: 3, ours: 1, mouton: 1, chien: 1 },
      { bucheron: 1, ours: 3, mouton: 1, chien: 1 },
      { bucheron: 1, ours: 1, mouton: 3, chien: 1 },
      { bucheron: 1, ours: 1, mouton: 1, chien: 3 },
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [120, 240],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 8 CASES — niveaux 3, 4, 5
  // ────────────────────────────────────────────────────────────────

  niveau_3: {
    // 4 types avec Chien, 3 vides fixes — nouveau plateau, difficulté modérée
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 2, chien: 2 },
      { bucheron: 3, ours: 2, mouton: 2, chien: 1 },
      { bucheron: 2, ours: 3, mouton: 2, chien: 1 },
      { bucheron: 2, ours: 2, mouton: 3, chien: 1 },
      { bucheron: 3, ours: 2, mouton: 1, chien: 2 },
      { bucheron: 2, ours: 3, mouton: 1, chien: 2 },
      { bucheron: 1, ours: 2, mouton: 3, chien: 2 },
      { bucheron: 3, ours: 1, mouton: 2, chien: 2 },
      { bucheron: 4, ours: 2, mouton: 1, chien: 1 },
      { bucheron: 1, ours: 4, mouton: 2, chien: 1 },
    ],
    emptyCellsRange: [3, 3],
    bonusDisabled: false,
    estimatedDurationRange: [150, 270],
  },

  niveau_4: {
    // 4 types avec Chien, 4 vides fixes — compositions plus asymétriques
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 2, chien: 2 },
      { bucheron: 3, ours: 2, mouton: 2, chien: 1 },
      { bucheron: 2, ours: 3, mouton: 2, chien: 1 },
      { bucheron: 2, ours: 2, mouton: 3, chien: 1 },
      { bucheron: 3, ours: 2, mouton: 1, chien: 2 },
      { bucheron: 2, ours: 3, mouton: 1, chien: 2 },
      { bucheron: 1, ours: 2, mouton: 3, chien: 2 },
      { bucheron: 3, ours: 1, mouton: 2, chien: 2 },
      { bucheron: 4, ours: 2, mouton: 1, chien: 1 },
      { bucheron: 1, ours: 4, mouton: 2, chien: 1 },
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [210, 360],
  },

  niveau_5: {
    // 4 types avec Chien, 5 vides fixes — maximum de liberté sur 8 cases
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 1, chien: 3 },
      { bucheron: 1, ours: 2, mouton: 2, chien: 3 },
      { bucheron: 2, ours: 1, mouton: 2, chien: 3 },
      { bucheron: 4, ours: 1, mouton: 2, chien: 1 },
      { bucheron: 1, ours: 4, mouton: 2, chien: 1 },
      { bucheron: 2, ours: 1, mouton: 4, chien: 1 },
      { bucheron: 4, ours: 2, mouton: 1, chien: 1 },
      { bucheron: 1, ours: 2, mouton: 4, chien: 1 },
      { bucheron: 3, ours: 3, mouton: 1, chien: 1 },
      { bucheron: 1, ours: 3, mouton: 3, chien: 1 },
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [300, 480],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 10 CASES — niveaux 6, 7, 8
  // ────────────────────────────────────────────────────────────────

  niveau_6: {
    // 3-4 types, 4 vides fixes — nouveau plateau, transition douce
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      { bucheron: 4, ours: 3, mouton: 3 },
      { bucheron: 3, ours: 4, mouton: 3 },
      { bucheron: 3, ours: 3, mouton: 4 },
      { bucheron: 4, ours: 4, mouton: 2 },
      { bucheron: 2, ours: 4, mouton: 4 },
      { bucheron: 4, ours: 2, mouton: 4 },
      { bucheron: 4, ours: 3, chien: 3 },
      { bucheron: 3, ours: 4, chien: 3 },
      { bucheron: 3, mouton: 4, chien: 3 },
      { bucheron: 4, mouton: 3, chien: 3 },
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [270, 420],
  },

  niveau_7: {
    // 4 types avec Chien, 5 vides fixes
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      { bucheron: 3, ours: 3, mouton: 2, chien: 2 },
      { bucheron: 2, ours: 3, mouton: 3, chien: 2 },
      { bucheron: 3, ours: 2, mouton: 3, chien: 2 },
      { bucheron: 4, ours: 2, mouton: 2, chien: 2 },
      { bucheron: 2, ours: 4, mouton: 2, chien: 2 },
      { bucheron: 2, ours: 2, mouton: 4, chien: 2 },
      { bucheron: 3, ours: 3, mouton: 1, chien: 3 },
      { bucheron: 1, ours: 3, mouton: 3, chien: 3 },
      { bucheron: 4, ours: 3, mouton: 1, chien: 2 },
      { bucheron: 2, ours: 1, mouton: 4, chien: 3 },
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [360, 540],
  },

  niveau_8: {
    // 4 types avec Chien, 6 vides fixes — maximum de liberté sur 10 cases
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      { bucheron: 3, ours: 3, mouton: 2, chien: 2 },
      { bucheron: 2, ours: 3, mouton: 3, chien: 2 },
      { bucheron: 3, ours: 2, mouton: 3, chien: 2 },
      { bucheron: 4, ours: 2, mouton: 2, chien: 2 },
      { bucheron: 2, ours: 4, mouton: 2, chien: 2 },
      { bucheron: 2, ours: 2, mouton: 4, chien: 2 },
      { bucheron: 3, ours: 3, mouton: 1, chien: 3 },
      { bucheron: 1, ours: 3, mouton: 3, chien: 3 },
      { bucheron: 4, ours: 3, mouton: 1, chien: 2 },
      { bucheron: 2, ours: 1, mouton: 4, chien: 3 },
    ],
    emptyCellsRange: [6, 6],
    bonusDisabled: false,
    estimatedDurationRange: [480, 660],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 12 CASES — niveaux 9 à 13
  // ────────────────────────────────────────────────────────────────

  niveau_9: {
    // 4 types, 5 vides fixes — nouveau plateau 12 cases, transition douce
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      { bucheron: 3, ours: 3, mouton: 3, chien: 3 },
      { bucheron: 4, ours: 3, mouton: 3, chien: 2 },
      { bucheron: 2, ours: 4, mouton: 3, chien: 3 },
      { bucheron: 3, ours: 2, mouton: 4, chien: 3 },
      { bucheron: 4, ours: 4, mouton: 2, chien: 2 },
      { bucheron: 2, ours: 2, mouton: 4, chien: 4 },
      { bucheron: 4, ours: 2, mouton: 2, chien: 4 },
      { bucheron: 3, ours: 4, mouton: 4, chien: 1 },
      { bucheron: 1, ours: 4, mouton: 3, chien: 4 },
      { bucheron: 4, ours: 1, mouton: 4, chien: 3 },
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [360, 540],
  },

  niveau_10: {
    // 4 types, 6 vides fixes
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      { bucheron: 3, ours: 3, mouton: 3, chien: 3 },
      { bucheron: 4, ours: 3, mouton: 3, chien: 2 },
      { bucheron: 2, ours: 4, mouton: 3, chien: 3 },
      { bucheron: 3, ours: 2, mouton: 4, chien: 3 },
      { bucheron: 4, ours: 4, mouton: 2, chien: 2 },
      { bucheron: 2, ours: 2, mouton: 4, chien: 4 },
      { bucheron: 4, ours: 2, mouton: 2, chien: 4 },
      { bucheron: 3, ours: 4, mouton: 4, chien: 1 },
      { bucheron: 1, ours: 4, mouton: 3, chien: 4 },
      { bucheron: 4, ours: 1, mouton: 4, chien: 3 },
    ],
    emptyCellsRange: [6, 6],
    bonusDisabled: false,
    estimatedDurationRange: [480, 720],
  },

  niveau_11: {
    // 5 types : + Chalet (doit avoir un Bucheron voisin), 7 vides fixes
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, chalet: 3 },
      { bucheron: 2, ours: 3, mouton: 3, chien: 2, chalet: 2 },
      { bucheron: 3, ours: 3, mouton: 2, chien: 1, chalet: 3 },
      { bucheron: 4, ours: 2, mouton: 2, chien: 2, chalet: 2 },
      { bucheron: 3, ours: 2, mouton: 3, chien: 2, chalet: 2 },
      { bucheron: 2, ours: 2, mouton: 2, chien: 3, chalet: 3 },
      { bucheron: 4, ours: 3, mouton: 1, chien: 2, chalet: 2 },
      { bucheron: 3, ours: 1, mouton: 3, chien: 2, chalet: 3 },
      { bucheron: 2, ours: 3, mouton: 2, chien: 3, chalet: 2 },
      { bucheron: 4, ours: 2, mouton: 3, chien: 1, chalet: 2 },
    ],
    emptyCellsRange: [7, 7],
    bonusDisabled: false,
    estimatedDurationRange: [600, 900],
  },

  niveau_12: {
    // 6 types : + Renard (ne peut pas être voisin d'un Mouton), 8 vides fixes
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, chalet: 2, renard: 2 },
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, chalet: 2, renard: 1 },
      { bucheron: 1, ours: 3, mouton: 2, chien: 2, chalet: 2, renard: 2 },
      { bucheron: 2, ours: 2, mouton: 3, chien: 2, chalet: 2, renard: 1 },
      { bucheron: 2, ours: 2, mouton: 2, chien: 3, chalet: 2, renard: 1 },
      { bucheron: 3, ours: 1, mouton: 2, chien: 2, chalet: 2, renard: 2 },
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, chalet: 3, renard: 1 },
      { bucheron: 1, ours: 2, mouton: 2, chien: 3, chalet: 2, renard: 2 },
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, chalet: 3, renard: 2 },
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, chalet: 3, renard: 2 },
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: false,
    estimatedDurationRange: [780, 1200],
  },

  niveau_13: {
    // 6 types, compositions très asymétriques, 9 vides fixes, bonus désactivés
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      { bucheron: 1, ours: 3, mouton: 2, chien: 2, chalet: 2, renard: 2 },
      { bucheron: 2, ours: 1, mouton: 3, chien: 2, chalet: 2, renard: 2 },
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, chalet: 2, renard: 2 },
      { bucheron: 2, ours: 2, mouton: 2, chien: 1, chalet: 3, renard: 2 },
      { bucheron: 2, ours: 2, mouton: 2, chien: 3, chalet: 1, renard: 2 },
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, chalet: 1, renard: 3 },
      { bucheron: 1, ours: 1, mouton: 3, chien: 3, chalet: 2, renard: 2 },
      { bucheron: 3, ours: 3, mouton: 1, chien: 1, chalet: 2, renard: 2 },
      { bucheron: 1, ours: 2, mouton: 2, chien: 2, chalet: 4, renard: 1 },
      { bucheron: 4, ours: 1, mouton: 2, chien: 2, chalet: 1, renard: 2 },
    ],
    emptyCellsRange: [9, 9],
    bonusDisabled: true,
    estimatedDurationRange: [1200, 1800],
  },
};

// Note : DifficultyLevel est défini dans Challenge.ts et ré-exporté ici
// pour la compatibilité avec les imports existants
